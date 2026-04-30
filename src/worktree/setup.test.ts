import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/me'),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const fs = (await import('fs')).default;
const { execSync } = await import('child_process');
const {
  resolveRcFileName,
  isShellIntegrationInstalled,
  MARKER,
  WorktreeSetup,
  WorktreeUninstall,
} = await import('./setup.js');

const CANONICAL_BLOCK = `# worktree-cli shell integration
wt() {
  rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
  wt-cli "$@"
  if [[ -f /tmp/.wt-cd-target ]]; then
    local target launch_claude=0
    target=$(cat /tmp/.wt-cd-target)
    [[ -f /tmp/.wt-launch-claude ]] && launch_claude=1
    rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
    cd "$target"
    [[ $launch_claude -eq 1 ]] && command claude
  fi
}

claude() {
  if [[ "$1" == "-w" ]]; then
    shift
    rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
    if [[ -n "$1" && "$1" != -* ]]; then
      local name="$1"; shift
      wt-cli --action=create --launch-claude --name="$name"
    else
      wt-cli --action=create --launch-claude
    fi
    if [[ -f /tmp/.wt-cd-target ]]; then
      local target
      target=$(cat /tmp/.wt-cd-target)
      rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
      cd "$target"
      command claude "$@"
    fi
  else
    command claude "$@"
  fi
}
`;

const STALE_LEGACY_BLOCK = `# worktree-cli shell integration
wt() {
  rm -f /tmp/.wt-cd-target
  node /Users/me/worktree-cli/tools/worktree.cli.js "$@"
  if [[ -f /tmp/.wt-cd-target ]]
  then
    local target
    target=$(cat /tmp/.wt-cd-target)
    rm -f /tmp/.wt-cd-target
    cd "$target"
  fi
}
`;

const wtCliFound = () => vi.mocked(execSync).mockImplementation(() => Buffer.from(''));
const wtCliMissing = () =>
  vi.mocked(execSync).mockImplementation(() => {
    throw new Error('not found');
  });

describe('resolveRcFileName', () => {
  let originalShell: string | undefined;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalShell = process.env.SHELL;
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    process.env.SHELL = originalShell;
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('maps zsh to .zshrc on any platform', () => {
    process.env.SHELL = '/bin/zsh';
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(resolveRcFileName()).toBe('.zshrc');
  });

  it('maps bash on darwin to .bash_profile', () => {
    process.env.SHELL = '/bin/bash';
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    expect(resolveRcFileName()).toBe('.bash_profile');
  });

  it('maps bash on linux to .bashrc', () => {
    process.env.SHELL = '/bin/bash';
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(resolveRcFileName()).toBe('.bashrc');
  });

  it('returns null for unsupported shells', () => {
    process.env.SHELL = '/usr/bin/fish';
    expect(resolveRcFileName()).toBeNull();
  });

  it('returns null when SHELL is unset', () => {
    delete process.env.SHELL;
    expect(resolveRcFileName()).toBeNull();
  });
});

describe('isShellIntegrationInstalled', () => {
  let originalShell: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalShell = process.env.SHELL;
    process.env.SHELL = '/bin/zsh';
  });

  afterEach(() => {
    process.env.SHELL = originalShell;
  });

  it('returns true when MARKER is present in rc file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`# unrelated\n${MARKER}\nwt() {}\n`);
    expect(isShellIntegrationInstalled()).toBe(true);
  });

  it('returns false when rc file lacks the MARKER', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# nothing here\n');
    expect(isShellIntegrationInstalled()).toBe(false);
  });

  it('returns false when rc file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(isShellIntegrationInstalled()).toBe(false);
  });

  it('returns false on unsupported shells', () => {
    process.env.SHELL = '/usr/bin/fish';
    expect(isShellIntegrationInstalled()).toBe(false);
  });
});

describe('WorktreeSetup.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalShell: string | undefined;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalShell = process.env.SHELL;
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    process.env.SHELL = '/bin/zsh';
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env.SHELL = originalShell;
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('logs an unsupported-shell message when shell cannot be resolved', async () => {
    process.env.SHELL = '/usr/bin/fish';
    await new WorktreeSetup().init();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported shell'));
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('logs "already installed" and writes nothing when block matches canonical', async () => {
    wtCliFound();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`# unrelated\n\n${CANONICAL_BLOCK}`);
    await new WorktreeSetup().init();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'));
    expect(fs.appendFileSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('migrates a legacy wt-only block to the full canonical block', async () => {
    wtCliFound();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      `# prelude\n\n${STALE_LEGACY_BLOCK}# postlude\n`
    );
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/home/me/.zshrc',
      `# prelude\n\n${CANONICAL_BLOCK}# postlude\n`
    );
    expect(fs.appendFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Updated existing'));
  });

  it('aborts with guidance when stale block exists but wt-cli is missing', async () => {
    wtCliMissing();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(STALE_LEGACY_BLOCK);
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('wt-cli is not on your PATH'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('npm link'));
  });

  it('creates the rc file when missing and appends the shell function', async () => {
    wtCliFound();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).toHaveBeenCalledWith('/home/me/.zshrc', '');
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/home/me/.zshrc',
      expect.stringContaining('wt-cli "$@"')
    );
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/home/me/.zshrc',
      expect.stringContaining('claude()')
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Shell integration added'));
  });

  it('appends without recreating when rc file exists without marker', async () => {
    wtCliFound();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# unrelated config\n');
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it('aborts with guidance when no block exists but wt-cli is missing', async () => {
    wtCliMissing();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# unrelated\n');
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('wt-cli is not on your PATH'));
  });
});

describe('WorktreeUninstall.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalShell: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalShell = process.env.SHELL;
    process.env.SHELL = '/bin/zsh';
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env.SHELL = originalShell;
  });

  it('removes the canonical block and preserves prelude/postlude', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`# prelude\n\n${CANONICAL_BLOCK}# postlude\n`);

    await new WorktreeUninstall().init();

    expect(fs.writeFileSync).toHaveBeenCalledWith('/home/me/.zshrc', '# prelude\n\n# postlude\n');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed shell integration'));
  });

  it('removes a legacy wt-only block', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`# prelude\n\n${STALE_LEGACY_BLOCK}# postlude\n`);

    await new WorktreeUninstall().init();

    expect(fs.writeFileSync).toHaveBeenCalledWith('/home/me/.zshrc', '# prelude\n\n# postlude\n');
  });

  it('logs "nothing to clean up" and writes nothing when MARKER is absent', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# unrelated config\n');

    await new WorktreeUninstall().init();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Nothing to clean up'));
  });

  it('does nothing when rc file is missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await new WorktreeUninstall().init();

    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Nothing to clean up'));
  });

  it('does nothing on unsupported shells', async () => {
    process.env.SHELL = '/usr/bin/fish';

    await new WorktreeUninstall().init();

    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
