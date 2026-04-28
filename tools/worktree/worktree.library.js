import { execSync } from 'child_process';
import pkg from 'enquirer';
import { colors } from '../extras/colors.js';
import { getWorktreesDir } from './worktree.constants.js';

const { prompt } = pkg;

export const worktreeLibrary = {
  getWorktrees() {
    const output = execSync('git worktree list --porcelain').toString();
    const blocks = output.split('\n\n').filter(Boolean);
    const worktrees = [];
    const worktreesDir = getWorktreesDir();

    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));

      if (!pathLine) continue;

      const wtPath = pathLine.replace('worktree ', '');

      // Only include worktrees under the worktrees directory
      if (!wtPath.startsWith(worktreesDir)) continue;

      const branch = branchLine ? branchLine.replace('branch refs/heads/', '') : '(detached)';

      worktrees.push({ path: wtPath, branch });
    }

    return worktrees;
  },

  getMergedBranches() {
    try {
      const output = execSync('git branch --merged master').toString();
      const branches = output
        .split('\n')
        .map((line) => line.trim().replace(/^[*+]\s*/, ''))
        .filter(Boolean);
      return new Set(branches);
    } catch {
      return new Set();
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
      // If it fails (dirty tree), try with --force
      try {
        execSync(`git worktree remove --force "${wtPath}"`, { stdio: 'pipe' });
        return true;
      } catch (err) {
        console.error(
          `${colors.red}Failed to remove worktree: ${wtPath}${colors.reset}`,
          err.message
        );
        return false;
      }
    }
  },

  pruneWorktrees() {
    execSync('git worktree prune');
  },

  fetchMaster() {
    execSync('git fetch origin master', { stdio: 'pipe' });
  },

  mergeMasterInto(wtPath) {
    try {
      const output = execSync(`git -C "${wtPath}" merge origin/master --no-edit`, {
        stdio: 'pipe',
      }).toString();
      if (/Already up to date/i.test(output)) return { status: 'up-to-date' };
      return { status: 'updated' };
    } catch (err) {
      try {
        execSync(`git -C "${wtPath}" merge --abort`, { stdio: 'pipe' });
      } catch {}
      return {
        status: 'conflict',
        message: err.stderr?.toString() || err.message,
      };
    }
  },

  stashPush(wtPath) {
    const output = execSync(
      `git -C "${wtPath}" stash push -u -m "wt-update autostash"`,
      { stdio: 'pipe' }
    ).toString();
    return !/No local changes to save/i.test(output);
  },

  stashPop(wtPath) {
    execSync(`git -C "${wtPath}" stash pop`, { stdio: 'pipe' });
  },

  async promptConfirmation(message) {
    console.log(''); // Space things out a bit...

    const { confirmed } = await prompt({
      type: 'confirm',
      name: 'confirmed',
      message,
    });

    return confirmed;
  },
};
