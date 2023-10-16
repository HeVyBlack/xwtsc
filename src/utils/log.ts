export function exitError(message: string) {
  console.error(message);
  process.exit(1);
}

export function exitWarn(message: string) {
  console.warn(message);
  process.exit(0);
}
