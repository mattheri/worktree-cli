#!/usr/bin/env node
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';
import { colors } from './extras/colors.js';
import { toolsUtility } from './extras/utils.js';
import { WorktreeList } from './worktree/list.js';
import { WorktreeCd } from './worktree/cd.js';
import { WorktreeRoot } from './worktree/root.js';
import { WorktreeClean } from './worktree/clean.js';
import { WorktreeUpdate } from './worktree/update.js';
import { WorktreeSetup } from './worktree/setup.js';

const { prompt } = enquirer;

export type Action = 'list' | 'cd' | 'root' | 'clean' | 'update' | 'setup' | 'exit';

interface InitOptions {
  action?: Action | string | true | null;
}

const messages = {
  actions: {
    list: '📋 List worktrees',
    cd: '📂 Change directory',
    root: '🏠 Go to root',
    clean: '🧹 Clean worktrees',
    update: '🔄 Update all worktrees with master',
    setup: '⚙️  Setup shell integration',
    exit: '🚪 Exit',
  },
  actionSelect: 'What would you like to do?',
  goodbye: '👋 Goodbye!',
};

const errorMessages = {
  aborting: `❌  ${colors.redBold}Aborting!${colors.reset}`,
};

class WorktreeCLI {
  constructor() {
    const baseConfig: InitOptions = {
      action: toolsUtility.getFlag('action'),
    };

    if (!baseConfig.action) {
      console.clear();
    }

    void this.init(baseConfig);
  }

  async init({ action }: InitOptions = {}): Promise<void> {
    try {
      if (!action || action === true) {
        action = await this.selectAction();
      }

      switch (action) {
        case 'list': {
          const list = new WorktreeList();
          await list.init();
          void this.init();
          break;
        }
        case 'cd': {
          const cd = new WorktreeCd();
          await cd.init();
          break;
        }
        case 'root': {
          const root = new WorktreeRoot();
          await root.init();
          break;
        }
        case 'clean': {
          const clean = new WorktreeClean();
          await clean.init();
          void this.init();
          break;
        }
        case 'update': {
          const update = new WorktreeUpdate();
          await update.init();
          void this.init();
          break;
        }
        case 'setup': {
          const setup = new WorktreeSetup();
          await setup.init();
          break;
        }
        case 'exit':
          console.log(messages.goodbye);
          break;
      }
    } catch (err) {
      if (err) {
        console.log(errorMessages.aborting);
        console.log(err + '\n');
      } else {
        console.log(messages.goodbye);
        process.exit();
      }
    }
  }

  async selectAction(): Promise<Action> {
    const { action } = await prompt<{ action: Action }>({
      type: 'select',
      name: 'action',
      message: messages.actionSelect,
      choices: [
        { name: 'list', message: messages.actions.list },
        { name: 'cd', message: messages.actions.cd },
        { name: 'root', message: messages.actions.root },
        { name: 'clean', message: messages.actions.clean },
        { name: 'update', message: messages.actions.update },
        { name: 'setup', message: messages.actions.setup },
        { name: 'exit', message: messages.actions.exit },
      ],
    });

    return action;
  }
}

export { WorktreeCLI };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  new WorktreeCLI();
}
