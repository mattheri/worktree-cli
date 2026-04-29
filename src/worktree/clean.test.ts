import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyWorktrees,
  mixedWorktrees,
  wtFeatureA,
  wtFeatureB,
  wtMerged,
  singleWorktree,
} from '../../tests/fixtures/worktrees.js';

vi.mock('./worktree.library.js', () => ({
  worktreeLibrary: {
    getWorktrees: vi.fn(),
    getMergedBranches: vi.fn(),
    getWorktreeStatus: vi.fn(() => 'clean'),
    removeWorktree: vi.fn(() => true),
    promptConfirmation: vi.fn(),
    pruneWorktrees: vi.fn(),
  },
}));

const { worktreeLibrary } = await import('./worktree.library.js');
const { WorktreeClean } = await import('./clean.js');

describe('WorktreeClean.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs and returns when there are no worktrees', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(emptyWorktrees);

    await new WorktreeClean().init();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No worktrees found'));
    expect(worktreeLibrary.pruneWorktrees).not.toHaveBeenCalled();
  });

  it('auto-removes merged worktrees without prompting', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtMerged]);
    vi.mocked(worktreeLibrary.getMergedBranches).mockReturnValue(new Set([wtMerged.branch]));

    await new WorktreeClean().init();

    expect(worktreeLibrary.removeWorktree).toHaveBeenCalledWith(wtMerged.path);
    expect(worktreeLibrary.promptConfirmation).not.toHaveBeenCalled();
    expect(worktreeLibrary.pruneWorktrees).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed 1 worktree.'));
  });

  it('prompts before removing unmerged worktrees and removes only when confirmed', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(mixedWorktrees);
    vi.mocked(worktreeLibrary.getMergedBranches).mockReturnValue(new Set([wtMerged.branch]));
    vi.mocked(worktreeLibrary.promptConfirmation)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await new WorktreeClean().init();

    expect(worktreeLibrary.removeWorktree).toHaveBeenCalledWith(wtMerged.path);
    expect(worktreeLibrary.removeWorktree).toHaveBeenCalledWith(wtFeatureA.path);
    expect(worktreeLibrary.removeWorktree).not.toHaveBeenCalledWith(wtFeatureB.path);
    expect(worktreeLibrary.promptConfirmation).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed 2 worktrees.'));
  });

  it('logs "All clean!" when nothing was removed', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(singleWorktree);
    vi.mocked(worktreeLibrary.getMergedBranches).mockReturnValue(new Set());
    vi.mocked(worktreeLibrary.promptConfirmation).mockResolvedValue(false);

    await new WorktreeClean().init();

    expect(worktreeLibrary.removeWorktree).not.toHaveBeenCalled();
    expect(worktreeLibrary.pruneWorktrees).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('All clean!'));
  });

  it('still calls pruneWorktrees even when remove fails', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtMerged]);
    vi.mocked(worktreeLibrary.getMergedBranches).mockReturnValue(new Set([wtMerged.branch]));
    vi.mocked(worktreeLibrary.removeWorktree).mockReturnValueOnce(false);

    await new WorktreeClean().init();

    expect(worktreeLibrary.pruneWorktrees).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('All clean!'));
  });
});
