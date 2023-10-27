import { fork } from 'child_process';
import ts from 'typescript';
import { getHooksPath } from '../runner/runner.option.js';

type EmitedFiles = Record<string, string>;

export class ChildInitialzer {
  constructor(
    private readonly file: string,
    private readonly args: string[],
    private readonly nodeArgs: string[],
  ) {}

  private readonly hooksPath = getHooksPath();

  init(options: ts.CompilerOptions, emitedFiles: EmitedFiles) {
    const execArgv = [
      '--no-warnings',
      `--loader=${this.hooksPath}`,
      ...this.nodeArgs,
    ];

    const env = {
      ...process.env,
      XWTSC_OPTIONS: JSON.stringify(options),
      XWTSC_EMITED_FILES: JSON.stringify(emitedFiles),
    };

    const child = fork(this.file, this.args, {
      execArgv,
      env,
    });

    return child;
  }
}
