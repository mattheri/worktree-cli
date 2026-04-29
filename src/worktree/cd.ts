import fs from 'fs';
import enquirer from 'enquirer';
import { worktreeLibrary } from './worktree.library.js';

interface PromptCtor {
  new (options: {
    name: string;
    message: string;
    choices: Array<{ name: string; message: string }>;
    limit?: number;
  }): { run(): Promise<string> };
}

const { AutoComplete } = enquirer as unknown as { AutoComplete: PromptCtor };

const CD_TARGET_FILE = '/tmp/.wt-cd-target';

class WorktreeCd {
  async init(): Promise<void> {
    const worktrees = worktreeLibrary.getWorktrees();

    if (worktrees.length === 0) {
      console.log('No worktrees found.');
      return;
    }

    const choices = worktrees.map((wt) => ({
      name: wt.path,
      message: wt.branch,
    }));

    const autocomplete = new AutoComplete({
      name: 'worktree',
      message: 'Select a worktree',
      choices,
      limit: 15,
    });

    const selectedPath = await autocomplete.run();
    fs.writeFileSync(CD_TARGET_FILE, selectedPath);
    console.log(`📂 Changing directory to ${selectedPath}`);
  }
}

export { WorktreeCd };
