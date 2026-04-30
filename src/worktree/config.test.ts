import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/me'),
  },
}));

const fs = (await import('fs')).default;
const { loadConfig, saveConfig, configPath } = await import('./config.js');

describe('configPath', () => {
  let originalXdg: string | undefined;

  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
  });

  it('falls back to ~/.wt-cli/config.json when XDG_CONFIG_HOME unset', () => {
    delete process.env.XDG_CONFIG_HOME;
    expect(configPath()).toBe('/home/me/.wt-cli/config.json');
  });

  it('honors XDG_CONFIG_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/xdg';
    expect(configPath()).toBe('/xdg/wt-cli/config.json');
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.XDG_CONFIG_HOME;
  });

  it('returns {} when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadConfig()).toEqual({});
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('returns parsed JSON when file is valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"creator":"claude"}');
    expect(loadConfig()).toEqual({ creator: 'claude' });
  });

  it('returns {} when file contents are unparsable', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not json');
    expect(loadConfig()).toEqual({});
  });

  it('returns {} when JSON parses to non-object (null)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('null');
    expect(loadConfig()).toEqual({});
  });
});

describe('saveConfig', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.XDG_CONFIG_HOME;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('mkdir -ps the config dir and writes JSON', () => {
    saveConfig({ creator: 'git' });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/home/me/.wt-cli', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/home/me/.wt-cli/config.json',
      '{\n  "creator": "git"\n}\n'
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and does not throw when mkdir fails (e.g. EACCES)', () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    });

    expect(() => saveConfig({ creator: 'claude' })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not persist preference'));
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
