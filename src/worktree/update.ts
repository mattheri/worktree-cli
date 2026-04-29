import enquirer from 'enquirer';
import { colors } from '../extras/colors.js';
import { worktreeLibrary, type Worktree } from './worktree.library.js';

interface PromptCtor {
  new (options: {
    name: string;
    message: string;
    choices: Array<{ name: string; message: string }>;
  }): { run(): Promise<string> };
}

const { Select } = enquirer as unknown as { Select: PromptCtor };

const messages = {
  noWorktrees: `${colors.yellow}No worktrees found.${colors.reset}`,
  fetching: `\n🔄 Fetching origin/master...`,
  fetchFailed: (err: string) => `${colors.red}Failed to fetch origin/master:${colors.reset} ${err}`,
  phase1Header: `\n📦 Updating clean worktrees...`,
  phase2Header: `\n⚠️  Dirty worktrees (uncommitted changes):`,
  updated: (branch: string) =>
    `  ${colors.green}✓${colors.reset} ${colors.cyan}${branch}${colors.reset} — updated`,
  upToDate: (branch: string) =>
    `  ${colors.dim}=${colors.reset} ${colors.cyan}${branch}${colors.reset} ${colors.dim}— already up to date${colors.reset}`,
  conflict: (branch: string) =>
    `  ${colors.red}✗${colors.reset} ${colors.cyan}${branch}${colors.reset} ${colors.red}— merge failed due to conflicts; worktree left unchanged${colors.reset}`,
  skipped: (branch: string) =>
    `  ${colors.dim}·${colors.reset} ${colors.cyan}${branch}${colors.reset} ${colors.dim}— skipped${colors.reset}`,
  dirtyPrompt: (branch: string) =>
    `${colors.cyan}${branch}${colors.reset} has uncommitted changes. What should I do?`,
  stashPopFailed: (branch: string) =>
    `    ${colors.yellow}Stash pop failed for ${branch}; your changes are still on the stash. Run 'git stash pop' manually after resolving.${colors.reset}`,
  summary: (updated: number, skipped: number, conflicts: number) =>
    `\n${colors.bold}Updated ${updated} · skipped ${skipped} · conflicts ${conflicts}${colors.reset}`,
  conflictsHeader: (count: number) =>
    `\n${colors.yellowBold}⚠️  ${count} worktree${count !== 1 ? 's were' : ' was'} NOT updated due to merge conflicts:${colors.reset}`,
  conflictBranch: (branch: string) =>
    `    ${colors.red}-${colors.reset} ${colors.cyan}${branch}${colors.reset}`,
  conflictHint: `    ${colors.dim}Resolve manually: wt cd <branch> && git merge master${colors.reset}`,
};

function getStderrOrMessage(err: unknown): string {
  const e = err as { stderr?: { toString(): string }; message?: string };
  return e.stderr?.toString() || e.message || String(err);
}

class WorktreeUpdate {
  async init(): Promise<void> {
    const worktrees = worktreeLibrary.getWorktrees();

    if (worktrees.length === 0) {
      console.log(messages.noWorktrees);
      return;
    }

    console.log(messages.fetching);
    try {
      worktreeLibrary.fetchMaster();
    } catch (err) {
      console.log(messages.fetchFailed(getStderrOrMessage(err)));
      return;
    }

    const clean: Worktree[] = [];
    const dirty: Worktree[] = [];
    for (const wt of worktrees) {
      const status = worktreeLibrary.getWorktreeStatus(wt.path);
      if (status === 'dirty') dirty.push(wt);
      else clean.push(wt);
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const conflicts: string[] = [];

    if (clean.length > 0) {
      console.log(messages.phase1Header);
      for (const wt of clean) {
        const result = worktreeLibrary.mergeMasterInto(wt.path);
        if (result.status === 'updated') {
          console.log(messages.updated(wt.branch));
          updatedCount++;
        } else if (result.status === 'up-to-date') {
          console.log(messages.upToDate(wt.branch));
        } else {
          console.log(messages.conflict(wt.branch));
          conflicts.push(wt.branch);
        }
      }
    }

    if (dirty.length > 0) {
      console.log(messages.phase2Header);
      for (const wt of dirty) {
        console.log('');
        const choice = await new Select({
          name: 'action',
          message: messages.dirtyPrompt(wt.branch),
          choices: [
            { name: 'stash', message: 'Stash, merge, then pop stash' },
            { name: 'merge', message: 'Merge anyway (no stash)' },
            { name: 'skip', message: 'Skip' },
          ],
        }).run();

        if (choice === 'skip') {
          console.log(messages.skipped(wt.branch));
          skippedCount++;
          continue;
        }

        let stashed = false;
        if (choice === 'stash') {
          try {
            stashed = worktreeLibrary.stashPush(wt.path);
          } catch (err) {
            console.log(
              `  ${colors.red}Failed to stash ${wt.branch}:${colors.reset} ${getStderrOrMessage(err)}`
            );
            skippedCount++;
            continue;
          }
        }

        const result = worktreeLibrary.mergeMasterInto(wt.path);

        if (stashed) {
          try {
            worktreeLibrary.stashPop(wt.path);
          } catch {
            console.log(messages.stashPopFailed(wt.branch));
          }
        }

        if (result.status === 'updated') {
          console.log(messages.updated(wt.branch));
          updatedCount++;
        } else if (result.status === 'up-to-date') {
          console.log(messages.upToDate(wt.branch));
        } else {
          console.log(messages.conflict(wt.branch));
          conflicts.push(wt.branch);
        }
      }
    }

    console.log(messages.summary(updatedCount, skippedCount, conflicts.length));

    if (conflicts.length > 0) {
      console.log(messages.conflictsHeader(conflicts.length));
      for (const branch of conflicts) {
        console.log(messages.conflictBranch(branch));
      }
      console.log(messages.conflictHint);
    }
  }
}

export { WorktreeUpdate };
