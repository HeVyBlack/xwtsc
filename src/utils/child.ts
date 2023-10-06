import { fork } from 'child_process';
import ts from 'typescript';
import { runnerHooksPath } from '../runner/runner.js';

export function initChild(
  file: string,
  args: string[],
  options: ts.CompilerOptions,
  emetidFiles: Record<string, string> = {},
) {
  const child = fork(file, args, {
    execArgv: ['--no-warnings', `--loader=${runnerHooksPath}`],
    env: {
      ...process.env,
      XWTSC_OPTIONS: JSON.stringify(options),
      XWTSC_EMITED_FILES: JSON.stringify(emetidFiles),
    },
  });

  return child;
}
