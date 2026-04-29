import { vi } from 'vitest';

export interface PromptInstance {
  run: () => Promise<string>;
}

export type PromptCtorMock = ReturnType<typeof createPromptCtor>;

export function createPromptCtor(answer: string) {
  const run = vi.fn().mockResolvedValue(answer);
  return vi.fn(function (this: { run: typeof run }) {
    this.run = run;
  });
}

export function createPromptCtorThatThrows(error: unknown) {
  const run = vi.fn().mockRejectedValue(error);
  return vi.fn(function (this: { run: typeof run }) {
    this.run = run;
  });
}

export function makeEnquirerMock(opts: {
  promptAnswer?: Record<string, unknown>;
  promptError?: unknown;
  selectAnswer?: string;
  autoCompleteAnswer?: string;
}) {
  const prompt = vi.fn();
  if (opts.promptError !== undefined) {
    prompt.mockRejectedValue(opts.promptError);
  } else {
    prompt.mockResolvedValue(opts.promptAnswer ?? {});
  }
  return {
    default: {
      prompt,
      Select: createPromptCtor(opts.selectAnswer ?? ''),
      AutoComplete: createPromptCtor(opts.autoCompleteAnswer ?? ''),
    },
  };
}
