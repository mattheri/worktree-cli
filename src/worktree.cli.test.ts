import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listInit = vi.fn().mockResolvedValue(undefined);
const cdInit = vi.fn().mockResolvedValue(undefined);
const rootInit = vi.fn().mockResolvedValue(undefined);
const cleanInit = vi.fn().mockResolvedValue(undefined);
const updateInit = vi.fn().mockResolvedValue(undefined);
const setupInit = vi.fn().mockResolvedValue(undefined);

vi.mock('./worktree/list.js', () => ({
  WorktreeList: vi.fn(function (this: { init: typeof listInit }) {
    this.init = listInit;
  }),
}));
vi.mock('./worktree/cd.js', () => ({
  WorktreeCd: vi.fn(function (this: { init: typeof cdInit }) {
    this.init = cdInit;
  }),
}));
vi.mock('./worktree/root.js', () => ({
  WorktreeRoot: vi.fn(function (this: { init: typeof rootInit }) {
    this.init = rootInit;
  }),
}));
vi.mock('./worktree/clean.js', () => ({
  WorktreeClean: vi.fn(function (this: { init: typeof cleanInit }) {
    this.init = cleanInit;
  }),
}));
vi.mock('./worktree/update.js', () => ({
  WorktreeUpdate: vi.fn(function (this: { init: typeof updateInit }) {
    this.init = updateInit;
  }),
}));
vi.mock('./worktree/setup.js', () => ({
  WorktreeSetup: vi.fn(function (this: { init: typeof setupInit }) {
    this.init = setupInit;
  }),
}));

const promptMock = vi.fn();
vi.mock('enquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => promptMock(...args),
  },
}));

const { WorktreeCLI } = await import('./worktree.cli.js');

describe('WorktreeCLI', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    originalArgv = process.argv;
  });

  afterEach(() => {
    logSpy.mockRestore();
    clearSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
  });

  it('selectAction returns the prompt answer', async () => {
    promptMock.mockResolvedValueOnce({ action: 'list' });
    process.argv = ['node', 'cli', '--action', 'exit'];

    const cli = new WorktreeCLI();
    await new Promise((r) => setImmediate(r));

    expect(await cli.selectAction()).toBe('list');
  });

  it('exit action logs goodbye without invoking other handlers', async () => {
    process.argv = ['node', 'cli', '--action', 'exit'];

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Goodbye'));
    expect(listInit).not.toHaveBeenCalled();
    expect(cdInit).not.toHaveBeenCalled();
  });

  it('list action runs WorktreeList.init and re-enters init (which prompts)', async () => {
    process.argv = ['node', 'cli', '--action', 'list'];
    promptMock.mockResolvedValueOnce({ action: 'exit' });

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(listInit).toHaveBeenCalledTimes(1);
    expect(promptMock).toHaveBeenCalledTimes(1);
  });

  it('cd action runs WorktreeCd.init and does NOT re-enter init', async () => {
    process.argv = ['node', 'cli', '--action', 'cd'];

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(cdInit).toHaveBeenCalledTimes(1);
    expect(promptMock).not.toHaveBeenCalled();
  });

  it('root action runs WorktreeRoot.init and does NOT re-enter init', async () => {
    process.argv = ['node', 'cli', '--action', 'root'];

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));

    expect(rootInit).toHaveBeenCalledTimes(1);
    expect(promptMock).not.toHaveBeenCalled();
  });

  it('clean action runs WorktreeClean.init and re-enters init', async () => {
    process.argv = ['node', 'cli', '--action', 'clean'];
    promptMock.mockResolvedValueOnce({ action: 'exit' });

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(cleanInit).toHaveBeenCalledTimes(1);
    expect(promptMock).toHaveBeenCalledTimes(1);
  });

  it('update action runs WorktreeUpdate.init and re-enters init', async () => {
    process.argv = ['node', 'cli', '--action', 'update'];
    promptMock.mockResolvedValueOnce({ action: 'exit' });

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(updateInit).toHaveBeenCalledTimes(1);
    expect(promptMock).toHaveBeenCalledTimes(1);
  });

  it('setup action runs WorktreeSetup.init and does NOT re-enter init', async () => {
    process.argv = ['node', 'cli', '--action', 'setup'];

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));

    expect(setupInit).toHaveBeenCalledTimes(1);
    expect(promptMock).not.toHaveBeenCalled();
  });

  it('clears the screen when no --action flag is passed', async () => {
    process.argv = ['node', 'cli'];
    promptMock.mockResolvedValueOnce({ action: 'exit' });

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));

    expect(clearSpy).toHaveBeenCalled();
  });

  it('logs aborting + the error when init throws a truthy error', async () => {
    process.argv = ['node', 'cli', '--action', 'list'];
    listInit.mockRejectedValueOnce(new Error('boom'));

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Aborting'));
  });

  it('logs goodbye and calls process.exit when init rejects with falsy value (Ctrl-C)', async () => {
    process.argv = ['node', 'cli', '--action', 'list'];
    listInit.mockRejectedValueOnce(undefined);

    new WorktreeCLI();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Goodbye'));
    expect(exitSpy).toHaveBeenCalled();
  });
});
