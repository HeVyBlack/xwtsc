import { join, resolve } from 'path';
import { platform } from 'os';
import { pathToFileURL } from 'url';

import { exitError } from '../utils/log.js';
import { parseFileArgs, parseTsConfigPath } from '../utils/args.js';
import { WatchRunner } from './runner.watcher.js';
import { Runner } from './runner.program.js';
import { ChildInitialzer } from '../utils/child.js';
import { readTsConfig } from '../libs/typescript/ts.functions.js';
import { XwtscOptions } from '../utils/xwtsc.js';

export function handleRunOption(args: string[]): void {
  let [verb] = args;
  const tsConfigPath = parseTsConfigPath(args);

  const { fileNames, options, raw } = readTsConfig(tsConfigPath);

  const xwtscOptions = new XwtscOptions(raw);

  if (!verb) verb = xwtscOptions.fileToRun;
  if (!verb) return exitError('Provied a verb or file to run!');

  const fileArgs = parseFileArgs(args, xwtscOptions);

  const nodeArgs = xwtscOptions.nodeArgs;

  if (verb === 'watch') {
    let fileToRun = args[1];

    if (!fileToRun) fileToRun = xwtscOptions.fileToRun;

    if (!fileToRun) return exitError('Provied a file to run!');

    const childInitialzer = new ChildInitialzer(fileToRun, fileArgs, nodeArgs);

    const watchBuilder = new WatchRunner(childInitialzer, tsConfigPath);

    return watchBuilder.initWatcher();
  } else {
    const fileToRun = verb;

    const childInitialzer = new ChildInitialzer(fileToRun, fileArgs, nodeArgs);

    const runner = new Runner(childInitialzer, options, fileNames);
    return runner.run();
  }
}

export function getHooksPath(): string {
  const behindDir = resolve(__dirname, '..');

  const hooksDir = join(behindDir, 'hooks');

  const hooksFile = join(hooksDir, 'hooks.mjs');

  if (platform() === 'win32') return pathToFileURL(hooksFile).href;
  else return hooksFile;
}
