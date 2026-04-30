import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
  },
}));

vi.mock('./worktree.constants.js', () => ({
  getRepoRoot: () => '/repo',
  getWorktreesDir: () => '/repo/.claude/worktrees',
}));

const findHooksMock = vi.fn();
const runHookMock = vi.fn();
vi.mock('./hooks.js', () => ({
  findHooks: findHooksMock,
  runHook: runHookMock,
}));

const promptMock = vi.fn();
vi.mock('enquirer', () => ({
  default: { prompt: promptMock },
}));

const loadConfigMock = vi.fn();
const saveConfigMock = vi.fn();
vi.mock('./config.js', () => ({
  loadConfig: loadConfigMock,
  saveConfig: saveConfigMock,
}));

const { execSync } = await import('child_process');
const fs = (await import('fs')).default;
const { WorktreeCreate, validateName, nameBudget } = await import('./create.js');

describe('validateName', () => {
  it('rejects empty / whitespace-only names', () => {
    expect(validateName('', 100)).toMatch(/empty/);
    expect(validateName('   ', 100)).toMatch(/empty/);
  });

  it('rejects names that exceed the byte budget', () => {
    expect(validateName('abcdef', 5)).toMatch(/exceeds/);
  });

  it('rejects names with invalid characters', () => {
    expect(validateName('foo bar', 100)).toMatch(/invalid/);
    expect(validateName('foo:bar', 100)).toMatch(/invalid/);
    expect(validateName('foo*', 100)).toMatch(/invalid/);
  });

  it('rejects names starting with - or /', () => {
    expect(validateName('-foo', 100)).toMatch(/start/);
    expect(validateName('/foo', 100)).toMatch(/start/);
  });

  it('accepts valid names', () => {
    expect(validateName('my-feature', 100)).toBe(true);
    expect(validateName('feat_42', 100)).toBe(true);
  });
});

describe('nameBudget', () => {
  it('caps at MAX_NAME_BYTES (255) for short paths', () => {
    expect(nameBudget('/repo/.claude/worktrees')).toBe(255);
  });

  it('shrinks when path budget would be exceeded', () => {
    const longDir = '/' + 'a'.repeat(900);
    expect(nameBudget(longDir)).toBeLessThan(255);
    expect(nameBudget(longDir)).toBeGreaterThan(0);
  });

  it('floors at 1 even for pathologically long dirs', () => {
    expect(nameBudget('/' + 'a'.repeat(2000))).toBe(1);
  });
});

describe('WorktreeCreate', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalArgv = process.argv;
    loadConfigMock.mockReturnValue({});
    findHooksMock.mockReturnValue([]);
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.argv = originalArgv;
  });

  it('uses --name flag and persisted git creator (no prompts, no launch marker)', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name=my-feature'];
    loadConfigMock.mockReturnValue({ creator: 'git' });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    await new WorktreeCreate().init();

    expect(promptMock).not.toHaveBeenCalled();
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith(
      'git worktree add -b "my-feature" "/repo/.claude/worktrees/my-feature" master',
      expect.objectContaining({ stdio: 'pipe' })
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/.wt-cd-target',
      '/repo/.claude/worktrees/my-feature'
    );
    expect(fs.writeFileSync).not.toHaveBeenCalledWith('/tmp/.wt-launch-claude', expect.anything());
  });

  it('prompts for name and creator on first run, persists creator, writes launch marker for claude', async () => {
    process.argv = ['node', 'cli', '--action=create'];
    loadConfigMock.mockReturnValue({});
    promptMock
      .mockResolvedValueOnce({ name: 'shiny' })
      .mockResolvedValueOnce({ creator: 'claude' });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    await new WorktreeCreate().init();

    const namePromptCall = promptMock.mock.calls[0]?.[0] as { message: string };
    expect(namePromptCall.message).toMatch(/max \d+ chars/);

    expect(saveConfigMock).toHaveBeenCalledWith({ creator: 'claude' });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/.wt-cd-target',
      '/repo/.claude/worktrees/shiny'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/.wt-launch-claude', '1');
  });

  it('skips creator prompt when --launch-claude flag is set, even with --name', async () => {
    process.argv = ['node', 'cli', '--action=create', '--launch-claude', '--name=feat'];
    loadConfigMock.mockReturnValue({ creator: 'git' });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    await new WorktreeCreate().init();

    expect(promptMock).not.toHaveBeenCalled();
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/.wt-launch-claude', '1');
  });

  it('skips creator prompt with persisted preference', async () => {
    process.argv = ['node', 'cli', '--action=create'];
    loadConfigMock.mockReturnValue({ creator: 'git' });
    promptMock.mockResolvedValueOnce({ name: 'feat' });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    await new WorktreeCreate().init();

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalledWith('/tmp/.wt-launch-claude', expect.anything());
  });

  it('rejects invalid --name flag without calling git', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name=bad name'];
    loadConfigMock.mockReturnValue({ creator: 'git' });

    await new WorktreeCreate().init();

    expect(execSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'));
  });

  it('delegates to a registered WorktreeCreate hook and uses its stdout as the path', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name=feat', '--launch-claude'];
    findHooksMock.mockReturnValue([
      {
        command: '.claude/hooks/create-worktree.sh',
        cwd: '/repo',
        source: '/repo/.claude/settings.json',
      },
    ]);
    runHookMock.mockReturnValue('/repo/.claude/worktrees/feat');

    await new WorktreeCreate().init();

    expect(runHookMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: '.claude/hooks/create-worktree.sh' }),
      expect.objectContaining({ name: 'feat', hook_event_name: 'WorktreeCreate' })
    );
    expect(execSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/.wt-cd-target',
      '/repo/.claude/worktrees/feat'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/.wt-launch-claude', '1');
  });

  it('logs an error when the hook outputs a non-existent path', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name=feat', '--launch-claude'];
    findHooksMock.mockReturnValue([
      { command: 'hook.sh', cwd: '/repo', source: '/repo/.claude/settings.json' },
    ]);
    runHookMock.mockReturnValue('/nonexistent/path');
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await new WorktreeCreate().init();

    expect(execSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('did not produce a valid worktree'));
  });

  it('logs git stderr when worktree add fails and does not write cd target', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name=dup', '--launch-claude'];
    vi.mocked(execSync).mockImplementation(() => {
      const err = new Error('fail') as Error & { stderr: Buffer };
      err.stderr = Buffer.from("fatal: a branch named 'dup' already exists");
      throw err;
    });

    await new WorktreeCreate().init();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create worktree'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });
});
