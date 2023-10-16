import { exitError } from './log.js';

export function parseTsConfigPath(args: string[]): string {
  const tsConfigPath = './tsconfig.json';
  if (args.includes('--tsconfig')) {
    const index = args.indexOf('--tsconfig') + 1;
    const aux = args[index];
    if (!aux) exitError('Provied a valid tsconfig!');
    else return tsConfigPath;
  }
  return tsConfigPath;
}

export function parseFileArgs(args: string[]): string[] {
  const fileArgs: string[] = [];

  if (args.includes('--args=')) {
    const index = args.indexOf('--args=') + 1;
    const auxArgs = args.slice(index);

    for (const a of auxArgs) fileArgs.push(a);
  }

  return fileArgs;
}
