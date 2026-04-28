import { colors } from '../extras/colors.js';
import { worktreeLibrary } from './worktree.library.js';

const messages = {
  scanning: `\n🔍 Scanning worktrees...`,
  autoRemoved: (branch) =>
    `  ${colors.green}✓${colors.reset} Removed ${colors.cyan}${branch}${colors.reset} (merged to master)`,
  promptRemove: (branch, status) =>
    `Remove ${colors.cyan}${branch}${colors.reset}? (${status === 'dirty' ? colors.yellow + 'dirty' + colors.reset : 'clean'}, not merged)`,
  pruning: `\n🧹 Pruning stale references...`,
  noWorktrees: `${colors.yellow}No worktrees found.${colors.reset}`,
  done: (count) =>
    `\n${colors.green}Done!${colors.reset} Removed ${count} worktree${count !== 1 ? 's' : ''}.`,
  nothingToClean: `\n${colors.green}All clean!${colors.reset} No worktrees to remove.`,
};

class WorktreeClean {
  constructor() {}

  async init() {
    const worktrees = worktreeLibrary.getWorktrees();

    if (worktrees.length === 0) {
      console.log(messages.noWorktrees);
      return;
    }

    const mergedBranches = worktreeLibrary.getMergedBranches();
    let removedCount = 0;

    console.log(messages.scanning);

    // Phase 1: Auto-remove merged worktrees
    const merged = worktrees.filter((wt) => mergedBranches.has(wt.branch));
    const unmerged = worktrees.filter((wt) => !mergedBranches.has(wt.branch));

    for (const wt of merged) {
      const removed = worktreeLibrary.removeWorktree(wt.path);
      if (removed) {
        console.log(messages.autoRemoved(wt.branch));
        removedCount++;
      }
    }

    if (merged.length > 0 && unmerged.length > 0) {
      console.log(''); // Visual separator between phases
    }

    // Phase 2: Prompt for unmerged worktrees
    for (const wt of unmerged) {
      const status = worktreeLibrary.getWorktreeStatus(wt.path);
      const confirmed = await worktreeLibrary.promptConfirmation(
        messages.promptRemove(wt.branch, status)
      );

      if (confirmed) {
        const removed = worktreeLibrary.removeWorktree(wt.path);
        if (removed) removedCount++;
      }
    }

    // Phase 3: Prune stale references
    console.log(messages.pruning);
    worktreeLibrary.pruneWorktrees();

    if (removedCount > 0) {
      console.log(messages.done(removedCount));
    } else {
      console.log(messages.nothingToClean);
    }
  }
}

export { WorktreeClean };
