import { fork } from 'child_process';
import ts from 'typescript';
import { getHooksPath } from '../runner/runner.option.js';

let hooksPath: string;
export function initChild(
  file: string,
  args: string[],
  options: ts.CompilerOptions,
  emitedFiles: Record<string, string> = {},
) {
  if (!hooksPath) hooksPath = getHooksPath();
  const child = fork(file, args, {
    execArgv: ['--no-warnings', `--loader=${hooksPath}`],
    env: {
      ...process.env,
      XWTSC_OPTIONS: JSON.stringify(options),
      XWTSC_EMITED_FILES: JSON.stringify(emitedFiles),
    },
  });

  return child;
}
