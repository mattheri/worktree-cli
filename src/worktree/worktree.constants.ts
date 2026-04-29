import { execSync } from 'child_process';

let _repoRoot: string | null = null;

export function getRepoRoot(): string {
  if (_repoRoot === null) {
    const firstLine = execSync('git worktree list --porcelain').toString().split('\n')[0] ?? '';
    _repoRoot = firstLine.replace('worktree ', '');
  }
  return _repoRoot;
}

export function getWorktreesDir(): string {
  return `${getRepoRoot()}/.claude/worktrees`;
}
