import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import enquirer from 'enquirer';
import { colors } from '../extras/colors.js';
import { toolsUtility } from '../extras/utils.js';
import { getWorktreesDir } from './worktree.constants.js';
import { loadConfig, saveConfig, type Creator } from './config.js';

const { prompt } = enquirer;

const CD_TARGET_FILE = '/tmp/.wt-cd-target';
const LAUNCH_CLAUDE_FILE = '/tmp/.wt-launch-claude';

const MAX_NAME_BYTES = 255;
const MAX_PATH_BYTES = 1024;

const FORBIDDEN_NAME_CHARS = /[\s~^:?*[\]\\]/;

export function nameBudget(dir: string): number {
  return Math.max(1, Math.min(MAX_NAME_BYTES, MAX_PATH_BYTES - dir.length - 1));
}

export function validateName(name: string, budget: number): string | true {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty';
  if (Buffer.byteLength(trimmed, 'utf8') > budget) {
    return `Name exceeds ${budget} character budget`;
  }
  if (FORBIDDEN_NAME_CHARS.test(trimmed)) {
    return 'Name contains invalid characters';
  }
  if (trimmed.startsWith('-') || trimmed.startsWith('/')) {
    return 'Name cannot start with - or /';
  }
  return true;
}

class WorktreeCreate {
  async init(): Promise<void> {
    const launchClaudeFlag = toolsUtility.getFlag('launch-claude') !== null;
    const nameFlag = toolsUtility.getFlag('name');
    const dir = getWorktreesDir();
    const budget = nameBudget(dir);

    let name: string;
    if (typeof nameFlag === 'string') {
      const v = validateName(nameFlag, budget);
      if (v !== true) {
        console.log(`${colors.red}${v}${colors.reset}`);
        return;
      }
      name = nameFlag.trim();
    } else {
      const { name: entered } = await prompt<{ name: string }>({
        type: 'input',
        name: 'name',
        message: `Worktree name (max ${budget} chars):`,
        validate: (v: string) => validateName(v, budget),
      });
      name = entered.trim();
    }

    const creator = await resolveCreator(launchClaudeFlag);

    const wtPath = path.join(dir, name);

    try {
      execSync(`git worktree add -b "${name}" "${wtPath}" master`, { stdio: 'pipe' });
    } catch (err) {
      const e = err as { stderr?: { toString(): string }; message?: string };
      console.log(`${colors.red}Failed to create worktree:${colors.reset}`);
      console.log(e.stderr?.toString() || e.message || String(err));
      return;
    }

    fs.writeFileSync(CD_TARGET_FILE, wtPath);
    if (creator === 'claude') {
      fs.writeFileSync(LAUNCH_CLAUDE_FILE, '1');
    }
    console.log(
      `${colors.green}✓${colors.reset} Created worktree ${colors.cyan}${name}${colors.reset} at ${wtPath}`
    );
  }
}

async function resolveCreator(forceClaude: boolean): Promise<Creator> {
  if (forceClaude) return 'claude';
  const cfg = loadConfig();
  if (cfg.creator === 'claude' || cfg.creator === 'git') return cfg.creator;

  const { creator } = await prompt<{ creator: Creator }>({
    type: 'select',
    name: 'creator',
    message: 'How would you like to add new worktrees?',
    choices: [
      { name: 'claude', message: 'Create with Claude (cd in and launch `claude`)' },
      { name: 'git', message: 'Plain `git worktree add`' },
    ],
  });
  saveConfig({ ...cfg, creator });
  return creator;
}

export { WorktreeCreate };
