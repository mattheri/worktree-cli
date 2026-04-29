const colors = {
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  cyanBold: '\x1b[36;1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  greenBold: '\x1b[32;1m',
  noBold: '\x1b[21m',
  red: '\x1b[31m',
  redBold: '\x1b[31;1m',
  reset: '\x1b[0;0m',
  resetBold: '\x1b[0;1m',
  yellow: '\x1b[33m',
  yellowBold: '\x1b[33;1m',
} as const;

export { colors };
