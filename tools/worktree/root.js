import fs from 'fs';
import { getRepoRoot } from './worktree.constants.js';

const CD_TARGET_FILE = '/tmp/.wt-cd-target';

class WorktreeRoot {
  constructor() {}

  async init() {
    const repoRoot = getRepoRoot();
    fs.writeFileSync(CD_TARGET_FILE, repoRoot);
    console.log(`🏠 Changing directory to ${repoRoot}`);
  }
}

export { WorktreeRoot };
