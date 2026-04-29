import { execSync } from 'child_process';

export const toolsUtility = {
  branchName(): string {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  },
  getFlag(flagName: string): string | true | null {
    const flagIndex = process.argv.indexOf(`--${flagName}`);

    if (flagIndex === -1) {
      return null;
    }

    const nextArgv = process.argv[flagIndex + 1];

    if (!nextArgv || nextArgv.substring(0, 2) === '--') {
      return true;
    }

    return nextArgv;
  },
};
