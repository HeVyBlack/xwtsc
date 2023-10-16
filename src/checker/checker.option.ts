import { parseTsConfigPath } from '../utils/args.js';
import { WatchChecker } from './checker.watcher.js';
import { Checker } from './checker.program.js';

export function handleCheckOption(args: string[]) {
  const [verb] = args;
  const tsConfigPath = parseTsConfigPath(args);

  if (verb === 'watch') {
    const watchBuilder = new WatchChecker(tsConfigPath);

    return watchBuilder.initWatcher();
  }

  const { fileNames, options } = Checker.readTsConfig(tsConfigPath);
  const checker = new Checker(options, fileNames);

  return checker.check();
}
