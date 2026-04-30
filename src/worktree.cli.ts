#!/usr/bin/env node
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';
import { colors } from './extras/colors.js';
import { toolsUtility } from './extras/utils.js';
import { WorktreeList } from './worktree/list.js';
import { WorktreeCd } from './worktree/cd.js';
import { WorktreeRoot } from './worktree/root.js';
import { WorktreeClean } from './worktree/clean.js';
import { WorktreeCreate } from './worktree/create.js';
import { WorktreeUpdate } from './worktree/update.js';
import {
  WorktreeSetup,
  WorktreeUninstall,
  isShellIntegrationInstalled,
} from './worktree/setup.js';

const { prompt } = enquirer;

export type Action =
  | 'list'
  | 'cd'
  | 'root'
  | 'clean'
  | 'create'
  | 'update'
  | 'setup'
  | 'uninstall'
  | 'exit';

interface InitOptions {
  action?: Action | string | true | null;
}

const messages = {
  actions: {
    list: '📋 List worktrees',
    cd: '📂 Checkout worktree',
    root: '🏠 Checkout master',
    clean: '🧹 Clean worktrees',
    update: '🔄 Update worktrees with master',
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
        case 'create': {
          const create = new WorktreeCreate();
          await create.init();
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
        case 'uninstall': {
          const uninstall = new WorktreeUninstall();
          await uninstall.init();
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
    const choices: Array<{ name: Action; message: string }> = [
      { name: 'list', message: messages.actions.list },
      { name: 'cd', message: messages.actions.cd },
      { name: 'root', message: messages.actions.root },
      { name: 'clean', message: messages.actions.clean },
      { name: 'update', message: messages.actions.update },
    ];

    if (!isShellIntegrationInstalled()) {
      choices.push({ name: 'setup', message: messages.actions.setup });
    }

    choices.push({ name: 'exit', message: messages.actions.exit });

    const { action } = await prompt<{ action: Action }>({
      type: 'select',
      name: 'action',
      message: messages.actionSelect,
      choices,
    });

    return action;
  }
}

export { WorktreeCLI };

// argv[1] may be a symlink (e.g. npm's bin shim), so compare resolved real paths.
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  new WorktreeCLI();
}
