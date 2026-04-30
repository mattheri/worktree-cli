import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/me'),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const fs = (await import('fs')).default;
const { execSync } = await import('child_process');
const { findHooks, runHook } = await import('./hooks.js');

describe('findHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no settings files have the event', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(findHooks('WorktreeCreate', '/repo')).toEqual([]);
  });

  it('collects command hooks from project settings.json', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p === '/repo/.claude/settings.json') {
        return JSON.stringify({
          hooks: {
            WorktreeCreate: [
              {
                matcher: '',
                hooks: [{ type: 'command', command: '.claude/hooks/create-worktree.sh' }],
              },
            ],
          },
        });
      }
      throw new Error('ENOENT');
    });

    const hooks = findHooks('WorktreeCreate', '/repo');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]).toMatchObject({
      command: '.claude/hooks/create-worktree.sh',
      cwd: '/repo',
      source: '/repo/.claude/settings.json',
    });
  });

  it('skips entries without type=command or empty command', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p === '/repo/.claude/settings.json') {
        return JSON.stringify({
          hooks: {
            WorktreeCreate: [
              {
                matcher: '',
                hooks: [
                  { type: 'webhook', command: 'http://example.com' },
                  { type: 'command' },
                  { type: 'command', command: '' },
                  { type: 'command', command: 'real.sh' },
                ],
              },
            ],
          },
        });
      }
      throw new Error('ENOENT');
    });

    const hooks = findHooks('WorktreeCreate', '/repo');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.command).toBe('real.sh');
  });

  it('orders hooks: user-level then project-level', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p === '/home/me/.claude/settings.json') {
        return JSON.stringify({
          hooks: {
            WorktreeCreate: [
              { matcher: '', hooks: [{ type: 'command', command: 'user.sh' }] },
            ],
          },
        });
      }
      if (p === '/repo/.claude/settings.json') {
        return JSON.stringify({
          hooks: {
            WorktreeCreate: [
              { matcher: '', hooks: [{ type: 'command', command: 'project.sh' }] },
            ],
          },
        });
      }
      throw new Error('ENOENT');
    });

    const hooks = findHooks('WorktreeCreate', '/repo');
    expect(hooks.map((h) => h.command)).toEqual(['user.sh', 'project.sh']);
  });

  it('ignores invalid JSON', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p === '/repo/.claude/settings.json') return 'not json';
      throw new Error('ENOENT');
    });
    expect(findHooks('WorktreeCreate', '/repo')).toEqual([]);
  });
});

describe('runHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs the command via bash with JSON on stdin and returns trimmed stdout', () => {
    vi.mocked(execSync).mockReturnValue('/repo/.claude/worktrees/feat\n' as never);

    const out = runHook(
      { command: '.claude/hooks/create-worktree.sh', cwd: '/repo', source: 'x' },
      { name: 'feat', hook_event_name: 'WorktreeCreate' }
    );

    expect(out).toBe('/repo/.claude/worktrees/feat');
    expect(execSync).toHaveBeenCalledWith(
      '.claude/hooks/create-worktree.sh',
      expect.objectContaining({
        cwd: '/repo',
        shell: '/bin/bash',
        input: expect.stringContaining('"name":"feat"'),
      })
    );
  });
});
