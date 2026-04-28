import { colors } from '../extras/colors.js';
import { worktreeLibrary } from './worktree.library.js';

const messages = {
  header: `\n${colors.bold}Branch${colors.reset}`,
  noWorktrees: `${colors.yellow}No worktrees found.${colors.reset}`,
};

class WorktreeList {
  constructor() {}

  async init() {
    const worktrees = worktreeLibrary.getWorktrees();

    if (worktrees.length === 0) {
      console.log(messages.noWorktrees);
      return;
    }

    const mergedBranches = worktreeLibrary.getMergedBranches();

    // Calculate column widths
    const maxBranchLen = Math.max(...worktrees.map((wt) => wt.branch.length), 6);
    const header = `${colors.bold}${'Branch'.padEnd(maxBranchLen + 2)}${'Status'.padEnd(10)}Merged${colors.reset}`;
    const separator = `${colors.dim}${'─'.repeat(maxBranchLen + 2 + 10 + 6)}${colors.reset}`;

    console.log('');
    console.log(header);
    console.log(separator);

    for (const wt of worktrees) {
      const status = worktreeLibrary.getWorktreeStatus(wt.path);
      const isMerged = mergedBranches.has(wt.branch);

      const branchCol = wt.branch.padEnd(maxBranchLen + 2);
      const statusCol =
        status === 'clean'
          ? `${colors.green}clean${colors.reset}`.padEnd(10 + 9) // +9 for ANSI escape chars
          : `${colors.yellow}dirty${colors.reset}`.padEnd(10 + 9);
      const mergedCol = isMerged
        ? `${colors.green}✓${colors.reset}`
        : `${colors.dim}✗${colors.reset}`;

      console.log(`${branchCol}${statusCol}${mergedCol}`);
    }

    console.log('');
  }
}

export { WorktreeList };
