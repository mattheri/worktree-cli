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

const fs = (await import('fs')).default;
const { resolveRcFileName, WorktreeSetup } = await import('./setup.js');

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

describe('WorktreeSetup.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalShell: string | undefined;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalShell = process.env.SHELL;
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
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

  it('returns early with "already installed" when marker exists', async () => {
    process.env.SHELL = '/bin/zsh';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# worktree-cli shell integration\nexisting');
    await new WorktreeSetup().init();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'));
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('creates the rc file when missing and appends the shell function', async () => {
    process.env.SHELL = '/bin/zsh';
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).toHaveBeenCalledWith('/home/me/.zshrc', '');
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/home/me/.zshrc',
      expect.stringContaining('wt-cli "$@"')
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Shell integration added'));
  });

  it('appends without recreating when rc file already exists without marker', async () => {
    process.env.SHELL = '/bin/zsh';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# unrelated config\n');
    await new WorktreeSetup().init();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).toHaveBeenCalled();
  });
});
