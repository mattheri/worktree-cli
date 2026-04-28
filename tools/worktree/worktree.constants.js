import { execSync } from 'child_process';

let _repoRoot = null;

export function getRepoRoot() {
  if (_repoRoot === null) {
    _repoRoot = execSync('git worktree list --porcelain')
      .toString()
      .split('\n')[0]
      .replace('worktree ', '');
  }
  return _repoRoot;
}

export function getWorktreesDir() {
  return `${getRepoRoot()}/.claude/worktrees`;
}
