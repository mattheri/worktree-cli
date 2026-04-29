import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../../tests/fixtures/worktrees.js';

vi.mock('./worktree.constants.js', () => ({
  getRepoRoot: vi.fn(() => REPO_ROOT),
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

const fs = (await import('fs')).default;
const { WorktreeRoot } = await import('./root.js');

describe('WorktreeRoot.init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('writes repo root to /tmp/.wt-cd-target and logs the destination', async () => {
    await new WorktreeRoot().init();

    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/.wt-cd-target', REPO_ROOT);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(REPO_ROOT));
  });
});
