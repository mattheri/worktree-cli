import { describe, expect, it } from 'vitest';
import { colors } from './colors.js';

describe('colors', () => {
  it('exposes the expected ANSI escape sequence keys', () => {
    expect(Object.keys(colors).sort()).toEqual(
      [
        'blue',
        'bold',
        'cyan',
        'cyanBold',
        'dim',
        'green',
        'greenBold',
        'noBold',
        'red',
        'redBold',
        'reset',
        'resetBold',
        'yellow',
        'yellowBold',
      ].sort()
    );
  });

  it('every value is a non-empty ANSI escape sequence', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^\x1b\[[\d;]+m$/);
    }
  });
});
