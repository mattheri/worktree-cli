import type { Worktree } from '../../src/worktree/worktree.library.js';

export interface PorcelainBlock {
  path: string;
  branch?: string;
}

export function worktreeListPorcelain(blocks: PorcelainBlock[]): string {
  return blocks
    .map((b) => {
      const lines = [`worktree ${b.path}`, `HEAD 0000000000000000000000000000000000000000`];
      if (b.branch) lines.push(`branch refs/heads/${b.branch}`);
      else lines.push('detached');
      return lines.join('\n');
    })
    .join('\n\n');
}

export function mergedBranchesOutput(branches: string[], current?: string): string {
  return branches
    .map((b) => (b === current ? `* ${b}` : `  ${b}`))
    .join('\n');
}

export function statusPorcelain(dirty: boolean): string {
  return dirty ? ' M src/foo.ts\n?? new-file.txt\n' : '';
}

export function stashPushOutput(stashed: boolean): string {
  return stashed
    ? 'Saved working directory and index state On feature: wt-update autostash\n'
    : 'No local changes to save\n';
}

export function mergeUpToDateOutput(): string {
  return 'Already up to date.\n';
}

export function mergeUpdatedOutput(): string {
  return 'Updating abc1234..def5678\nFast-forward\n src/file.ts | 2 +-\n';
}

export type { Worktree };
