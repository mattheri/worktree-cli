import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const { execSync } = await import('child_process');
const { toolsUtility } = await import('./utils.js');

describe('toolsUtility.getFlag', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns null when flag is absent', () => {
    process.argv = ['node', 'script.js', 'positional'];
    expect(toolsUtility.getFlag('action')).toBeNull();
  });

  it('returns the next argument when flag is followed by a value', () => {
    process.argv = ['node', 'script.js', '--action', 'list'];
    expect(toolsUtility.getFlag('action')).toBe('list');
  });

  it('returns true when flag is the last argument', () => {
    process.argv = ['node', 'script.js', '--action'];
    expect(toolsUtility.getFlag('action')).toBe(true);
  });

  it('returns true when flag is followed by another --flag', () => {
    process.argv = ['node', 'script.js', '--action', '--verbose'];
    expect(toolsUtility.getFlag('action')).toBe(true);
  });

  it('parses --flag=value form', () => {
    process.argv = ['node', 'script.js', '--action=list'];
    expect(toolsUtility.getFlag('action')).toBe('list');
  });

  it('returns true for --flag= with empty value', () => {
    process.argv = ['node', 'script.js', '--action='];
    expect(toolsUtility.getFlag('action')).toBe(true);
  });

  it('parses --flag=value when interleaved with other flags', () => {
    process.argv = ['node', 'script.js', '--launch-claude', '--name=foo'];
    expect(toolsUtility.getFlag('name')).toBe('foo');
    expect(toolsUtility.getFlag('launch-claude')).toBe(true);
  });
});

describe('toolsUtility.branchName', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('returns trimmed git branch output', () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from('  main\n'));
    expect(toolsUtility.branchName()).toBe('main');
    expect(execSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD');
  });
});
