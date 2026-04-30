import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

vi.mock('./worktree.constants.js', () => ({
  getWorktreesDir: () => '/repo/.claude/worktrees',
}));

const { execSync } = await import('child_process');
const fs = (await import('fs')).default;
const { WorktreeCreate } = await import('./create.js');

describe('WorktreeCreate', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalArgv = process.argv;
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.argv = originalArgv;
  });

  it('runs git worktree add with the resolved path and writes /tmp/.wt-cd-target', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name', 'my-feature'];
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    await new WorktreeCreate().init();

    expect(execSync).toHaveBeenCalledWith(
      'git worktree add -b "my-feature" "/repo/.claude/worktrees/my-feature" master',
      expect.objectContaining({ stdio: 'pipe' })
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/.wt-cd-target',
      '/repo/.claude/worktrees/my-feature'
    );
  });

  it('logs an error and skips writing the cd target when --name is missing', async () => {
    process.argv = ['node', 'cli', '--action=create'];

    await new WorktreeCreate().init();

    expect(execSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('--name <name> is required'));
  });

  it('logs git stderr when worktree add fails and does not write cd target', async () => {
    process.argv = ['node', 'cli', '--action=create', '--name', 'dup'];
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
