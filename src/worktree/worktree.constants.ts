import { execSync } from 'child_process';

let _repoRoot: string | null = null;
let _defaultBranch: string | null = null;

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

function tryGit(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function getDefaultBranch(): string {
  if (_defaultBranch !== null) return _defaultBranch;

  const symref = tryGit('git symbolic-ref --short refs/remotes/origin/HEAD');
  if (symref) {
    _defaultBranch = symref.replace(/^origin\//, '');
    return _defaultBranch;
  }

  for (const candidate of ['main', 'master']) {
    if (tryGit(`git rev-parse --verify --quiet refs/remotes/origin/${candidate}`)) {
      _defaultBranch = candidate;
      return _defaultBranch;
    }
  }

  for (const candidate of ['main', 'master']) {
    if (tryGit(`git rev-parse --verify --quiet refs/heads/${candidate}`)) {
      _defaultBranch = candidate;
      return _defaultBranch;
    }
  }

  throw new Error(
    'Could not determine default branch — set origin/HEAD or ensure main/master exists'
  );
}
