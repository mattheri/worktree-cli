import fs from 'fs';
import os from 'os';
import path from 'path';

export type Creator = 'claude' | 'git';

export interface Config {
  creator?: Creator;
}

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return xdg ? path.join(xdg, 'wt-cli') : path.join(os.homedir(), '.config', 'wt-cli');
}

export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export function loadConfig(): Config {
  const p = configPath();
  if (!fs.existsSync(p)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Config;
    return {};
  } catch {
    return {};
  }
}

export function saveConfig(cfg: Config): void {
  const p = configPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  } catch (err) {
    const msg = (err as { message?: string }).message ?? String(err);
    console.warn(`Could not persist preference to ${p}: ${msg}`);
    console.warn('You will be re-prompted on the next create. Worktree creation continues.');
  }
}
