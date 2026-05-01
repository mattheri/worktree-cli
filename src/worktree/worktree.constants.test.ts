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

  describe('getDefaultBranch', () => {
    it('returns the branch from origin/HEAD symref', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (String(cmd).includes('symbolic-ref')) return Buffer.from('origin/main\n');
        throw new Error('should not be called');
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(getDefaultBranch()).toBe('main');
      expect(getDefaultBranch()).toBe('main');
      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('handles a master symref', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (String(cmd).includes('symbolic-ref')) return Buffer.from('origin/master\n');
        throw new Error('unexpected');
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(getDefaultBranch()).toBe('master');
    });

    it('falls back to origin/main when symref is missing', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd) => {
        const c = String(cmd);
        if (c.includes('symbolic-ref')) throw new Error('no symref');
        if (c.includes('refs/remotes/origin/main')) return Buffer.from('abc123\n');
        throw new Error('unexpected: ' + c);
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(getDefaultBranch()).toBe('main');
    });

    it('falls back to origin/master when origin/main is missing', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd) => {
        const c = String(cmd);
        if (c.includes('symbolic-ref')) throw new Error('no symref');
        if (c.includes('refs/remotes/origin/main')) throw new Error('not found');
        if (c.includes('refs/remotes/origin/master')) return Buffer.from('abc123\n');
        throw new Error('unexpected: ' + c);
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(getDefaultBranch()).toBe('master');
    });

    it('falls back to local main when no remote refs exist', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd) => {
        const c = String(cmd);
        if (c.includes('symbolic-ref')) throw new Error('no symref');
        if (c.includes('refs/remotes/origin/')) throw new Error('not found');
        if (c.includes('refs/heads/main')) return Buffer.from('abc123\n');
        throw new Error('unexpected: ' + c);
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(getDefaultBranch()).toBe('main');
    });

    it('throws when nothing resolves', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('git fail');
      });

      const { getDefaultBranch } = await import('./worktree.constants.js');

      expect(() => getDefaultBranch()).toThrow(/Could not determine default branch/);
    });
  });
});
