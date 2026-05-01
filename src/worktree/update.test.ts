import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyWorktrees,
  mixedWorktrees,
  singleWorktree,
  wtDirty,
  wtFeatureA,
} from '../../tests/fixtures/worktrees.js';

vi.mock('./worktree.constants.js', () => ({
  getDefaultBranch: vi.fn(() => 'main'),
}));

vi.mock('./worktree.library.js', () => ({
  worktreeLibrary: {
    getWorktrees: vi.fn(),
    getWorktreeStatus: vi.fn(),
    fetchDefaultBranch: vi.fn(),
    mergeDefaultBranchInto: vi.fn(() => ({ status: 'updated' })),
    stashPush: vi.fn(),
    stashPop: vi.fn(),
  },
}));

const selectRun = vi.fn();
const selectCtor = vi.fn(function (this: { run: typeof selectRun }) {
  this.run = selectRun;
});
vi.mock('enquirer', () => ({
  default: {
    Select: selectCtor,
  },
}));

const { worktreeLibrary } = await import('./worktree.library.js');
const { WorktreeUpdate } = await import('./update.js');

describe('WorktreeUpdate.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs and returns when no worktrees', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(emptyWorktrees);

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.fetchDefaultBranch).not.toHaveBeenCalled();
  });

  it('aborts with a fetch-failed message when fetchDefaultBranch throws', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(singleWorktree);
    vi.mocked(worktreeLibrary.fetchDefaultBranch).mockImplementationOnce(() => {
      throw Object.assign(new Error('boom'), { stderr: Buffer.from('network error') });
    });

    await new WorktreeUpdate().init();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'));
    expect(worktreeLibrary.mergeDefaultBranchInto).not.toHaveBeenCalled();
  });

  it('updates clean worktrees and reports updated/up-to-date/conflict counts', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(mixedWorktrees);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('clean');
    vi.mocked(worktreeLibrary.mergeDefaultBranchInto)
      .mockReturnValueOnce({ status: 'updated' })
      .mockReturnValueOnce({ status: 'up-to-date' })
      .mockReturnValueOnce({ status: 'conflict', message: 'CONFLICT (content)' });

    await new WorktreeUpdate().init();

    const allLogs = logSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('Updated 1');
    expect(allLogs).toContain('skipped 0');
    expect(allLogs).toContain('conflicts 1');
    expect(allLogs).toContain('NOT updated due to merge conflicts');
  });

  it('skip choice for dirty worktree increments skippedCount and does not merge', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('dirty');
    selectRun.mockResolvedValueOnce('skip');

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.mergeDefaultBranchInto).not.toHaveBeenCalled();
    expect(worktreeLibrary.stashPush).not.toHaveBeenCalled();
    const allLogs = logSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('skipped 1');
  });

  it('merge choice for dirty worktree merges without stashing', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('dirty');
    vi.mocked(worktreeLibrary.mergeDefaultBranchInto).mockReturnValueOnce({ status: 'updated' });
    selectRun.mockResolvedValueOnce('merge');

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.stashPush).not.toHaveBeenCalled();
    expect(worktreeLibrary.mergeDefaultBranchInto).toHaveBeenCalledWith(wtDirty.path);
    expect(worktreeLibrary.stashPop).not.toHaveBeenCalled();
  });

  it('stash choice does push → merge → pop in order', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('dirty');
    vi.mocked(worktreeLibrary.stashPush).mockReturnValueOnce(true);
    vi.mocked(worktreeLibrary.mergeDefaultBranchInto).mockReturnValueOnce({ status: 'updated' });
    selectRun.mockResolvedValueOnce('stash');

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.stashPush).toHaveBeenCalledWith(wtDirty.path);
    expect(worktreeLibrary.mergeDefaultBranchInto).toHaveBeenCalledWith(wtDirty.path);
    expect(worktreeLibrary.stashPop).toHaveBeenCalledWith(wtDirty.path);
  });

  it('logs stash-pop-failed when pop throws', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('dirty');
    vi.mocked(worktreeLibrary.stashPush).mockReturnValueOnce(true);
    vi.mocked(worktreeLibrary.mergeDefaultBranchInto).mockReturnValueOnce({ status: 'updated' });
    vi.mocked(worktreeLibrary.stashPop).mockImplementationOnce(() => {
      throw new Error('pop failed');
    });
    selectRun.mockResolvedValueOnce('stash');

    await new WorktreeUpdate().init();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Stash pop failed'));
  });

  it('counts a stash-push failure as skipped without merging', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockReturnValue('dirty');
    vi.mocked(worktreeLibrary.stashPush).mockImplementationOnce(() => {
      throw new Error('stash blew up');
    });
    selectRun.mockResolvedValueOnce('stash');

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.mergeDefaultBranchInto).not.toHaveBeenCalled();
    const allLogs = logSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('skipped 1');
  });

  it('partitions clean and dirty worktrees correctly', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue([wtFeatureA, wtDirty]);
    vi.mocked(worktreeLibrary.getWorktreeStatus).mockImplementation((p) =>
      p === wtDirty.path ? 'dirty' : 'clean'
    );
    vi.mocked(worktreeLibrary.mergeDefaultBranchInto).mockReturnValueOnce({ status: 'updated' });
    selectRun.mockResolvedValueOnce('skip');

    await new WorktreeUpdate().init();

    expect(worktreeLibrary.mergeDefaultBranchInto).toHaveBeenCalledTimes(1);
    expect(worktreeLibrary.mergeDefaultBranchInto).toHaveBeenCalledWith(wtFeatureA.path);
  });
});
