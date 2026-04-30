import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { colors } from '../extras/colors.js';
import { toolsUtility } from '../extras/utils.js';
import { getWorktreesDir } from './worktree.constants.js';

const CD_TARGET_FILE = '/tmp/.wt-cd-target';

class WorktreeCreate {
  async init(): Promise<void> {
    const nameFlag = toolsUtility.getFlag('name');

    if (!nameFlag || nameFlag === true) {
      console.log(`${colors.red}--name <name> is required${colors.reset}`);
      return;
    }

    const name = nameFlag;
    const wtPath = path.join(getWorktreesDir(), name);

    try {
      execSync(`git worktree add -b "${name}" "${wtPath}" master`, { stdio: 'pipe' });
    } catch (err) {
      const e = err as { stderr?: { toString(): string }; message?: string };
      console.log(`${colors.red}Failed to create worktree:${colors.reset}`);
      console.log(e.stderr?.toString() || e.message || String(err));
      return;
    }

    fs.writeFileSync(CD_TARGET_FILE, wtPath);
    console.log(
      `${colors.green}✓${colors.reset} Created worktree ${colors.cyan}${name}${colors.reset} at ${wtPath}`
    );
  }
}

export { WorktreeCreate };
