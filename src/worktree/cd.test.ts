import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyWorktrees, mixedWorktrees } from '../../tests/fixtures/worktrees.js';

vi.mock('./worktree.library.js', () => ({
  worktreeLibrary: {
    getWorktrees: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

const autoCompleteRun = vi.fn();
const autoCompleteCtor = vi.fn(function (this: { run: typeof autoCompleteRun }) {
  this.run = autoCompleteRun;
});
vi.mock('enquirer', () => ({
  default: {
    AutoComplete: autoCompleteCtor,
  },
}));

const { worktreeLibrary } = await import('./worktree.library.js');
const fs = (await import('fs')).default;
const { WorktreeCd } = await import('./cd.js');

describe('WorktreeCd.init', () => {
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

    await new WorktreeCd().init();

    expect(logSpy).toHaveBeenCalledWith('No worktrees found.');
    expect(autoCompleteCtor).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('builds AutoComplete choices from worktrees and writes the chosen path to /tmp/.wt-cd-target', async () => {
    vi.mocked(worktreeLibrary.getWorktrees).mockReturnValue(mixedWorktrees);
    autoCompleteRun.mockResolvedValueOnce(mixedWorktrees[1]!.path);

    await new WorktreeCd().init();

    expect(autoCompleteCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'worktree',
        choices: mixedWorktrees.map((wt) => ({ name: wt.path, message: wt.branch })),
      })
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/.wt-cd-target', mixedWorktrees[1]!.path);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(mixedWorktrees[1]!.path));
  });
});
