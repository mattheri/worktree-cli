import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { worktreeListPorcelain } from '../../tests/fixtures/git-output.js';
import { REPO_ROOT } from '../../tests/fixtures/worktrees.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('worktree.constants', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getRepoRoot shells out on first call and caches subsequent calls', async () => {
    const { execSync } = await import('child_process');
    vi.mocked(execSync).mockReturnValue(
      Buffer.from(worktreeListPorcelain([{ path: REPO_ROOT, branch: 'main' }]))
    );

    const { getRepoRoot } = await import('./worktree.constants.js');

    expect(getRepoRoot()).toBe(REPO_ROOT);
    expect(getRepoRoot()).toBe(REPO_ROOT);
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(execSync).toHaveBeenCalledWith('git worktree list --porcelain');
  });

  it('getWorktreesDir appends .claude/worktrees to repo root', async () => {
    const { execSync } = await import('child_process');
    vi.mocked(execSync).mockReturnValue(
      Buffer.from(worktreeListPorcelain([{ path: REPO_ROOT, branch: 'main' }]))
    );

    const { getWorktreesDir } = await import('./worktree.constants.js');

    expect(getWorktreesDir()).toBe(`${REPO_ROOT}/.claude/worktrees`);
  });
});
