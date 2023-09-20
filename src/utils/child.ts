import { fork } from 'child_process';
import ts from 'typescript';
import { runnerHooksPath } from '../runner/runner.js';

export function initChild(
  file: string,
  args: string[],
  options: ts.CompilerOptions,
) {
  const child = fork(file, args, {
    execArgv: ['--no-warnings', `--loader=${runnerHooksPath}`],
    env: { ...process.env, XWTSC_OPTIONS: JSON.stringify(options) },
  });

  return child;
}
