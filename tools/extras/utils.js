import { execSync } from 'child_process';

export const toolsUtility = {
  branchName() {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  },
  getFlag(flagName) {
    // Go through the command line arguments and find a flag, then output the next value if found
    // For instance: `node i18n.cli.js --something theValue` looking for "something" would output "theValue"
    const flagIndex = process.argv.indexOf(`--${flagName}`);

    // Couldn't find flag, return null
    if (flagIndex === -1) {
      return null;
    }

    // Flag found, what's the next argument?
    const nextArgv = process.argv[flagIndex + 1];

    // If there's none or if it's another flag, just return true
    if (!nextArgv || nextArgv.substring(0, 2) === '--') {
      return true;
    }

    return nextArgv;
  },
};
