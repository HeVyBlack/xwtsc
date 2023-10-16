import { AliasExtReplacer } from '../ext.replacer.js';
import { parseTsConfigPath } from '../utils/args.js';
import { WatchBuilder } from './builder.watcher.js';
import { Builder } from './builder.program.js';

export function handleBuildOption(
  args: string[],
  aliasExtReplacer: AliasExtReplacer,
) {
  const [verb] = args;
  const tsConfigPath = parseTsConfigPath(args);

  if (verb === 'watch') {
    const watchBuilder = new WatchBuilder(aliasExtReplacer, tsConfigPath);
    return watchBuilder.initWatcher();
  }

  const { fileNames, options } = Builder.readTsConfig(tsConfigPath);

  const builder = new Builder(aliasExtReplacer, options, fileNames);
  return builder.build();
}
