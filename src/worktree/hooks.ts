import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface HookCommand {
  type?: string;
  command?: string;
}

interface HookEntry {
  matcher?: string;
  hooks?: HookCommand[];
}

interface SettingsFile {
  hooks?: Record<string, HookEntry[]>;
}

export interface ResolvedHook {
  command: string;
  cwd: string;
  source: string;
}

function readSettings(filePath: string): SettingsFile | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SettingsFile;
  } catch {
    return null;
  }
}

export function findHooks(eventName: string, repoRoot: string): ResolvedHook[] {
  const home = os.homedir();
  const settingsPaths = [
    path.join(home, '.claude', 'settings.json'),
    path.join(home, '.claude', 'settings.local.json'),
    path.join(repoRoot, '.claude', 'settings.json'),
    path.join(repoRoot, '.claude', 'settings.local.json'),
  ];

  const out: ResolvedHook[] = [];
  for (const p of settingsPaths) {
    const settings = readSettings(p);
    const entries = settings?.hooks?.[eventName];
    if (!entries) continue;
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        if (h.type !== 'command' || !h.command) continue;
        // Project hooks resolve relative paths against repoRoot;
        // user-level hooks against the user's home.
        const cwd = p.startsWith(home + path.sep) && !p.startsWith(repoRoot) ? home : repoRoot;
        out.push({ command: h.command, cwd, source: p });
      }
    }
  }
  return out;
}

export function runHook(hook: ResolvedHook, payload: Record<string, unknown>): string {
  return execSync(hook.command, {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: hook.cwd,
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: '/bin/bash',
  }).trim();
}
