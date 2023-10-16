import { join, resolve } from 'path';
import { platform } from 'os';
import { pathToFileURL } from 'url';

import { exitError } from '../utils/log.js';
import { parseFileArgs, parseTsConfigPath } from '../utils/args.js';
import { WatchRunner } from './runner.watcher.js';
import { Runner } from './runner.program.js';

export function handleRunOption(args: string[]): void {
  const [verb] = args;
  const tsConfigPath = parseTsConfigPath(args);
  if (!verb) return exitError('Provied a verb or file to run!');

  const fileArgs = parseFileArgs(args);

  if (verb === 'watch') {
    const fileToRun = args[1];
    if (!fileToRun) return exitError('Provied a file to run!');

    const watchBuilder = new WatchRunner(fileToRun, fileArgs, tsConfigPath);
    return watchBuilder.initWatcher();
  } else {
    const fileToRun = verb;

    const { fileNames, options } = Runner.readTsConfig(tsConfigPath);
    const runner = new Runner(fileToRun, fileArgs, options, fileNames);
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
