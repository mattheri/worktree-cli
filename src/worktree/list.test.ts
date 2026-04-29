import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mixedWorktrees, emptyWorktrees, wtFeatureA, wtMerged } from '../../tests/fixtures/worktrees.js';

vi.mock('./worktree.library.js', () => ({
  worktreeLibrary: {
    getWorktrees: vi.fn(),
    getMergedBranches: vi.fn(),
    getWorktreeStatus: vi.fn(),
  },
}));

const { worktreeLibrary } = await import('./worktree.library.js');
const { WorktreeList } = await import('./list.js');

describe('WorktreeList.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs "No worktrees found." and returns when there are none', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(emptyWorktrees);

    await new WorktreeList().init();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No worktrees found'));
    expect(worktreeLibrary.getMergedBranches).not.toHaveBeenCalled();
  });

  it('renders header + a row per worktree with status and merged glyph', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(mixedWorktrees);
    vi.mocked(worktreeLibrary.getMergedBranches).mockReturnValue(new Set([wtMerged.branch]));
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockImplementation((wtPath) =>
      wtPath === wtFeatureA.path ? 'dirty' : 'clean'
    );

    await new WorktreeList().init();

    const allLogs = logSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('Branch');
    expect(allLogs).toContain('Status');
    expect(allLogs).toContain('Merged');
    for (const wt of mixedWorktrees) {
      expect(allLogs).toContain(wt.branch);
    }
    expect(allLogs).toContain('clean');
    expect(allLogs).toContain('dirty');
  });
});
