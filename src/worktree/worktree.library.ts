import { execSync } from 'child_process';
import pkg from 'enquirer';
import { colors } from '../extras/colors.js';
import { getDefaultBranch, getWorktreesDir } from './worktree.constants.js';

const { prompt } = pkg;

export type Worktree = {
  path: string;
  branch: string;
};

export type WorktreeStatus = 'clean' | 'dirty' | 'unknown';

export type MergeResult =
  | { status: 'updated' }
  | { status: 'up-to-date' }
  | { status: 'conflict'; message: string };

export interface WorktreeLibrary {
  getWorktrees(): Worktree[];
  getMergedBranches(): Set<string>;
  getWorktreeStatus(wtPath: string): WorktreeStatus;
  removeWorktree(wtPath: string): boolean;
  pruneWorktrees(): void;
  fetchDefaultBranch(): void;
  mergeDefaultBranchInto(wtPath: string): MergeResult;
  stashPush(wtPath: string): boolean;
  stashPop(wtPath: string): void;
  promptConfirmation(message: string): Promise<boolean>;
}

export const worktreeLibrary: WorktreeLibrary = {
  getWorktrees() {
    const output = execSync('git worktree list --porcelain').toString();
    const blocks = output.split('\n\n').filter(Boolean);
    const worktrees: Worktree[] = [];
    const worktreesDir = getWorktreesDir();

    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));

      if (!pathLine) continue;

      const wtPath = pathLine.replace('worktree ', '');

      if (!wtPath.startsWith(worktreesDir)) continue;

      const branch = branchLine ? branchLine.replace('branch refs/heads/', '') : '(detached)';

      worktrees.push({ path: wtPath, branch });
    }

    return worktrees;
  },

  getMergedBranches() {
    try {
      const output = execSync(`git branch --merged origin/${getDefaultBranch()}`).toString();
      const branches = output
        .split('\n')
        .map((line) => line.trim().replace(/^[*+]\s*/, ''))
        .filter(Boolean);
      return new Set(branches);
    } catch {
      return new Set<string>();
    }
  },

  getWorktreeStatus(wtPath) {
    try {
      const output = execSync(`git -C "${wtPath}" status --porcelain`, {
        encoding: 'utf-8',
      });
      return output.trim() ? 'dirty' : 'clean';
    } catch {
      return 'unknown';
    }
  },

  removeWorktree(wtPath) {
    try {
      execSync(`git worktree remove "${wtPath}"`, { stdio: 'pipe' });
      return true;
    } catch {
      try {
        execSync(`git worktree remove --force "${wtPath}"`, { stdio: 'pipe' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `${colors.red}Failed to remove worktree: ${wtPath}${colors.reset}`,
          message
        );
        return false;
      }
    }
  },

  pruneWorktrees() {
    execSync('git worktree prune');
  },

  fetchDefaultBranch() {
    execSync(`git fetch origin ${getDefaultBranch()}`, { stdio: 'pipe' });
  },

  mergeDefaultBranchInto(wtPath) {
    try {
      const output = execSync(
        `git -C "${wtPath}" merge origin/${getDefaultBranch()} --no-edit`,
        { stdio: 'pipe' }
      ).toString();
      if (/Already up to date/i.test(output)) return { status: 'up-to-date' };
      return { status: 'updated' };
    } catch (err) {
      try {
        execSync(`git -C "${wtPath}" merge --abort`, { stdio: 'pipe' });
      } catch {}
      const errorWithStderr = err as { stderr?: { toString(): string }; message?: string };
      return {
        status: 'conflict',
        message: errorWithStderr.stderr?.toString() || errorWithStderr.message || String(err),
      };
    }
  },

  stashPush(wtPath) {
    const output = execSync(`git -C "${wtPath}" stash push -u -m "wt-update autostash"`, {
      stdio: 'pipe',
    }).toString();
    return !/No local changes to save/i.test(output);
  },

  stashPop(wtPath) {
    execSync(`git -C "${wtPath}" stash pop`, { stdio: 'pipe' });
  },

  async promptConfirmation(message) {
    console.log('');

    const { confirmed } = await prompt<{ confirmed: boolean }>({
      type: 'confirm',
      name: 'confirmed',
      message,
    });

    return confirmed;
  },
};
