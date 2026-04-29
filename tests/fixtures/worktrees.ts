import type { Worktree } from '../../src/worktree/worktree.library.js';

export const REPO_ROOT = '/repo';
export const WORKTREES_DIR = `${REPO_ROOT}/.claude/worktrees`;

export const wtFeatureA: Worktree = {
  path: `${WORKTREES_DIR}/feature-a`,
  branch: 'feature-a',
};

export const wtFeatureB: Worktree = {
  path: `${WORKTREES_DIR}/feature-b`,
  branch: 'feature-b',
};

export const wtMerged: Worktree = {
  path: `${WORKTREES_DIR}/merged-branch`,
  branch: 'merged-branch',
};

export const wtDirty: Worktree = {
  path: `${WORKTREES_DIR}/dirty-branch`,
  branch: 'dirty-branch',
};

export const emptyWorktrees: Worktree[] = [];

export const singleWorktree: Worktree[] = [wtFeatureA];

export const mixedWorktrees: Worktree[] = [wtMerged, wtFeatureA, wtFeatureB];

export type { Worktree };
