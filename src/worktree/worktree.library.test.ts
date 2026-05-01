import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mergedBranchesOutput,
  mergeUpdatedOutput,
  mergeUpToDateOutput,
  stashPushOutput,
  statusPorcelain,
  worktreeListPorcelain,
} from '../../tests/fixtures/git-output.js';
import { REPO_ROOT, WORKTREES_DIR } from '../../tests/fixtures/worktrees.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('./worktree.constants.js', () => ({
  getRepoRoot: vi.fn(() => REPO_ROOT),
  getWorktreesDir: vi.fn(() => WORKTREES_DIR),
  getDefaultBranch: vi.fn(() => 'main'),
}));

const promptMock = vi.fn();
vi.mock('enquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => promptMock(...args),
  },
}));

const { execSync } = await import('child_process');
const { worktreeLibrary } = await import('./worktree.library.js');

describe('worktreeLibrary.getWorktrees', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('parses porcelain blocks and yields {path, branch} for worktrees under the worktrees dir', () => {
    vi.mocked(execSync).mockReturnValueOnce(
      Buffer.from(
        worktreeListPorcelain([
          { path: REPO_ROOT, branch: 'main' },
          { path: `${WORKTREES_DIR}/feature-a`, branch: 'feature-a' },
          { path: `${WORKTREES_DIR}/feature-b`, branch: 'feature-b' },
        ])
      )
    );

    const result = worktreeLibrary.getWorktrees();

    expect(result).toEqual([
      { path: `${WORKTREES_DIR}/feature-a`, branch: 'feature-a' },
      { path: `${WORKTREES_DIR}/feature-b`, branch: 'feature-b' },
    ]);
  });

  it('marks branch as (detached) when no branch line is present', () => {
    const detachedBlock = `worktree ${WORKTREES_DIR}/detached\nHEAD abc1234`;
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(detachedBlock));

    const result = worktreeLibrary.getWorktrees();

    expect(result).toEqual([{ path: `${WORKTREES_DIR}/detached`, branch: '(detached)' }]);
  });
});

describe('worktreeLibrary.getMergedBranches', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('strips * and + markers and returns a Set', () => {
    vi.mocked(execSync).mockReturnValueOnce(
      Buffer.from(mergedBranchesOutput(['main', 'feature-a', 'feature-b'], 'main'))
    );

    const result = worktreeLibrary.getMergedBranches();

    expect(result).toEqual(new Set(['main', 'feature-a', 'feature-b']));
    expect(execSync).toHaveBeenCalledWith('git branch --merged origin/main');
  });

  it('returns an empty Set when execSync throws', () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('not a git repo');
    });

    expect(worktreeLibrary.getMergedBranches()).toEqual(new Set<string>());
  });
});

describe('worktreeLibrary.getWorktreeStatus', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('returns "clean" when status output is empty', () => {
    vi.mocked(execSync).mockReturnValueOnce(statusPorcelain(false));
    expect(worktreeLibrary.getWorktreeStatus('/wt')).toBe('clean');
  });

  it('returns "dirty" when status output is non-empty', () => {
    vi.mocked(execSync).mockReturnValueOnce(statusPorcelain(true));
    expect(worktreeLibrary.getWorktreeStatus('/wt')).toBe('dirty');
  });

  it('returns "unknown" when execSync throws', () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(worktreeLibrary.getWorktreeStatus('/wt')).toBe('unknown');
  });
});

describe('worktreeLibrary.removeWorktree', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(execSync).mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns true when the first git remove succeeds', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));
    expect(worktreeLibrary.removeWorktree('/wt')).toBe(true);
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('falls back to --force when the first remove fails, returning true', () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw new Error('dirty');
      })
      .mockReturnValueOnce(Buffer.from(''));

    expect(worktreeLibrary.removeWorktree('/wt')).toBe(true);
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(vi.mocked(execSync).mock.calls[1]?.[0]).toContain('--force');
  });

  it('returns false and logs when both attempts fail', () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw new Error('first');
      })
      .mockImplementationOnce(() => {
        throw new Error('second');
      });

    expect(worktreeLibrary.removeWorktree('/wt')).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('worktreeLibrary.pruneWorktrees / fetchDefaultBranch', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('pruneWorktrees calls git worktree prune', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));
    worktreeLibrary.pruneWorktrees();
    expect(execSync).toHaveBeenCalledWith('git worktree prune');
  });

  it('fetchDefaultBranch calls git fetch origin <default>', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));
    worktreeLibrary.fetchDefaultBranch();
    expect(execSync).toHaveBeenCalledWith(
      'git fetch origin main',
      expect.objectContaining({ stdio: 'pipe' })
    );
  });
});

describe('worktreeLibrary.mergeDefaultBranchInto', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('returns up-to-date when the merge output matches', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(mergeUpToDateOutput()));
    expect(worktreeLibrary.mergeDefaultBranchInto('/wt')).toEqual({ status: 'up-to-date' });
  });

  it('returns updated when the merge applied changes', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(mergeUpdatedOutput()));
    expect(worktreeLibrary.mergeDefaultBranchInto('/wt')).toEqual({ status: 'updated' });
    expect(vi.mocked(execSync).mock.calls[0]?.[0]).toContain('merge origin/main');
  });

  it('returns conflict and attempts merge --abort cleanup when merge fails', () => {
    const err = Object.assign(new Error('merge fail'), {
      stderr: Buffer.from('CONFLICT (content)\n'),
    });
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw err;
      })
      .mockReturnValueOnce(Buffer.from(''));

    const result = worktreeLibrary.mergeDefaultBranchInto('/wt');

    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.message).toContain('CONFLICT');
    }
    expect(vi.mocked(execSync).mock.calls[1]?.[0]).toContain('merge --abort');
  });

  it('still returns conflict when merge --abort itself throws', () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw new Error('merge fail');
      })
      .mockImplementationOnce(() => {
        throw new Error('abort fail');
      });

    expect(worktreeLibrary.mergeDefaultBranchInto('/wt').status).toBe('conflict');
  });
});

describe('worktreeLibrary.stashPush / stashPop', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('stashPush returns true when changes were stashed', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(stashPushOutput(true)));
    expect(worktreeLibrary.stashPush('/wt')).toBe(true);
  });

  it('stashPush returns false on "No local changes to save"', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(stashPushOutput(false)));
    expect(worktreeLibrary.stashPush('/wt')).toBe(false);
  });

  it('stashPop calls git stash pop in the worktree', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));
    worktreeLibrary.stashPop('/wt');
    expect(vi.mocked(execSync).mock.calls[0]?.[0]).toContain('stash pop');
  });
});

describe('worktreeLibrary.promptConfirmation', () => {
  beforeEach(() => {
    promptMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns the confirmed value from the prompt', async () => {
    promptMock.mockResolvedValueOnce({ confirmed: true });
    expect(await worktreeLibrary.promptConfirmation('Sure?')).toBe(true);

    promptMock.mockResolvedValueOnce({ confirmed: false });
    expect(await worktreeLibrary.promptConfirmation('Sure?')).toBe(false);
  });
});
