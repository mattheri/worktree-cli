import fs from 'fs';
import os from 'os';
import path from 'path';
import { colors } from '../extras/colors.js';

const MARKER = '# worktree-cli shell integration';

// macOS Terminal.app opens login shells by default, which read .bash_profile
// rather than .bashrc — so on darwin we target .bash_profile for bash users.
function resolveRcFileName() {
  const shell = path.basename(process.env.SHELL || '');

  if (shell === 'zsh') return '.zshrc';
  if (shell === 'bash') return process.platform === 'darwin' ? '.bash_profile' : '.bashrc';

  return null;
}

class WorktreeSetup {
  constructor() {}

  async init() {
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

    const existingContent = fs.readFileSync(rcPath, 'utf-8');

    if (existingContent.includes(MARKER)) {
      console.log(
        `${colors.yellow}Shell integration already installed in ${displayPath}${colors.reset}`
      );
      return;
    }

    // The /tmp path is hardcoded (matches cd.js); os.tmpdir() on macOS returns
    // /var/folders/... which differs from /tmp.
    const shellFunction = `
${MARKER}
wt() {
  rm -f /tmp/.wt-cd-target
  wt-cli "$@"
  if [[ -f /tmp/.wt-cd-target ]]; then
    local target
    target=$(cat /tmp/.wt-cd-target)
    rm -f /tmp/.wt-cd-target
    cd "$target"
  fi
}
`;

    fs.appendFileSync(rcPath, shellFunction);
    console.log(`${colors.green}Shell integration added to ${displayPath}${colors.reset}`);
    console.log(
      `Run ${colors.cyan}source ${displayPath}${colors.reset} or restart your shell to start using ${colors.bold}wt${colors.reset}.`
    );
  }
}

export { WorktreeSetup };
