import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { colors } from '../extras/colors.js';

export const MARKER = '# worktree-cli shell integration';

const SHELL_FUNCTION = `${MARKER}
wt() {
  rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
  wt-cli "$@"
  if [[ -f /tmp/.wt-cd-target ]]; then
    local target launch_claude=0
    target=$(cat /tmp/.wt-cd-target)
    [[ -f /tmp/.wt-launch-claude ]] && launch_claude=1
    rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
    cd "$target"
    [[ $launch_claude -eq 1 ]] && command claude
  fi
}

claude() {
  if [[ "$1" == "-w" ]]; then
    shift
    rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
    if [[ -n "$1" && "$1" != -* ]]; then
      local name="$1"; shift
      wt-cli --action=create --launch-claude --name="$name"
    else
      wt-cli --action=create --launch-claude
    fi
    if [[ -f /tmp/.wt-cd-target ]]; then
      local target
      target=$(cat /tmp/.wt-cd-target)
      rm -f /tmp/.wt-cd-target /tmp/.wt-launch-claude
      cd "$target"
      command claude "$@"
    fi
  else
    command claude "$@"
  fi
}
`;

// Matches MARKER through the LAST closing-brace line of the integration block.
// Greedy `[\s\S]*` plus `\n}\n?$` (anchored to end-of-block-as-followed-by-non-`}`)
// keeps us from stopping at `wt()`'s closing `}` when `claude()` follows.
const BLOCK_REGEX =
  /# worktree-cli shell integration\nwt\(\) \{[\s\S]*?\n\}\n+claude\(\) \{[\s\S]*?\n\}\n?/;

// Pre-claude-wrapper blocks only had `wt()`. Match MARKER through `wt()`'s
// closing `}` (no `claude()` following).
const LEGACY_BLOCK_REGEX = /# worktree-cli shell integration\nwt\(\) \{[\s\S]*?\n\}\n?/;

// macOS Terminal.app opens login shells by default, which read .bash_profile
// rather than .bashrc — so on darwin we target .bash_profile for bash users.
export function resolveRcFileName(): string | null {
  const shell = path.basename(process.env.SHELL || '');

  if (shell === 'zsh') return '.zshrc';
  if (shell === 'bash') return process.platform === 'darwin' ? '.bash_profile' : '.bashrc';

  return null;
}

export function isShellIntegrationInstalled(): boolean {
  const rcFileName = resolveRcFileName();
  if (!rcFileName) return false;
  const rcPath = path.join(os.homedir(), rcFileName);
  if (!fs.existsSync(rcPath)) return false;
  return fs.readFileSync(rcPath, 'utf-8').includes(MARKER);
}

function isWtCliOnPath(): boolean {
  try {
    execSync('command -v wt-cli', { stdio: 'ignore', shell: '/bin/sh' });
    return true;
  } catch {
    return false;
  }
}

function logMissingWtCli(): void {
  console.log(`${colors.red}wt-cli is not on your PATH.${colors.reset}`);
  console.log(
    `Run ${colors.cyan}npm link${colors.reset} in the worktree-cli repo, or ${colors.cyan}npm install -g worktree-cli${colors.reset}, then re-run setup.`
  );
}

class WorktreeSetup {
  async init(): Promise<void> {
    const rcFileName = resolveRcFileName();

    if (!rcFileName) {
      const detected = process.env.SHELL || '(unset)';
      console.log(`${colors.red}Unsupported shell: ${detected}${colors.reset}`);
      console.log(
        `Shell integration is only available for ${colors.bold}zsh${colors.reset} and ${colors.bold}bash${colors.reset}.`
      );
      return;
    }

    const rcPath = path.join(os.homedir(), rcFileName);
    const displayPath = `~/${rcFileName}`;

    if (!fs.existsSync(rcPath)) {
      fs.writeFileSync(rcPath, '');
    }

    const existing = fs.readFileSync(rcPath, 'utf-8');
    const match = existing.match(BLOCK_REGEX);

    if (match && match[0].trimEnd() === SHELL_FUNCTION.trimEnd()) {
      console.log(
        `${colors.yellow}Shell integration already installed in ${displayPath}${colors.reset}`
      );
      return;
    }

    if (!isWtCliOnPath()) {
      logMissingWtCli();
      return;
    }

    if (existing.includes(MARKER)) {
      const updated = match
        ? existing.replace(BLOCK_REGEX, SHELL_FUNCTION)
        : replaceLegacyBlock(existing, SHELL_FUNCTION);
      fs.writeFileSync(rcPath, updated);
      console.log(
        `${colors.green}Updated existing shell integration in ${displayPath}${colors.reset}`
      );
    } else {
      fs.appendFileSync(rcPath, `\n${SHELL_FUNCTION}`);
      console.log(`${colors.green}Shell integration added to ${displayPath}${colors.reset}`);
    }

    console.log(
      `Run ${colors.cyan}source ${displayPath}${colors.reset} or restart your shell to start using ${colors.bold}wt${colors.reset}.`
    );
    console.log(
      `${colors.dim}When you're done with this tool, run ${colors.reset}${colors.cyan}wt-cli --action uninstall${colors.reset}${colors.dim} BEFORE ${colors.reset}${colors.cyan}npm uninstall -g${colors.reset}${colors.dim} to clean up your rc file.${colors.reset}`
    );
  }
}

function replaceLegacyBlock(existing: string, replacement: string): string {
  return existing.replace(LEGACY_BLOCK_REGEX, replacement);
}

class WorktreeUninstall {
  async init(): Promise<void> {
    const rcFileName = resolveRcFileName();
    if (!rcFileName) return;

    const rcPath = path.join(os.homedir(), rcFileName);
    const displayPath = `~/${rcFileName}`;

    if (!fs.existsSync(rcPath)) {
      console.log(`${colors.yellow}Nothing to clean up in ${displayPath}${colors.reset}`);
      return;
    }

    const existing = fs.readFileSync(rcPath, 'utf-8');
    if (!existing.includes(MARKER)) {
      console.log(`${colors.yellow}Nothing to clean up in ${displayPath}${colors.reset}`);
      return;
    }

    let cleaned = existing.replace(BLOCK_REGEX, '');
    if (cleaned === existing) {
      cleaned = cleaned.replace(LEGACY_BLOCK_REGEX, '');
    }
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(rcPath, cleaned);
    console.log(
      `${colors.green}Removed shell integration from ${displayPath}${colors.reset}`
    );
  }
}

export { WorktreeSetup, WorktreeUninstall };
