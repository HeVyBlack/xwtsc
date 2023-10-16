#!/usr/bin/env node
process.env['IS_XWTSC'] = 'true';

import { Project as MorphProject } from 'ts-morph';
import { ChangeTsExts } from './libs/morph/morph.change.js';
import { prepareSingleFileReplaceTscAliasPaths } from 'tsc-alias';
import { handleBuildOption } from './builder/builder.option.js';
import { handleCheckOption } from './checker/checker.option.js';
import { handleRunOption } from './runner/runner.option.js';
import { AliasExtReplacer } from './ext.replacer.js';
import { exitError } from './utils/log.js';
import { parseTsConfigPath } from './utils/args.js';
import { handleInitOption } from './init.option.js';

async function main(args: string[]): Promise<void> {
  const [option] = args;

  if (!option) return exitError('Provied a option!');

  const options = ['run', 'build', 'check', 'init'];
  if (!options.includes(option)) return exitError('Provied a valid option!');

  if (option === 'init') return handleInitOption();

  const tsConfigPath = parseTsConfigPath(args);

  if (option === 'run') return handleRunOption(args.slice(1));

  const morphProject = new MorphProject({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
    compilerOptions: {
      noEmit: true,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      strict: false,
    },
  });

  if (option === 'check') return handleCheckOption(args.slice(1));

  const changeTsExt = new ChangeTsExts();

  const fileReplacer = await prepareSingleFileReplaceTscAliasPaths({
    configFile: tsConfigPath,
    resolveFullPaths: true,
  });

  const aliasExtReplacer = new AliasExtReplacer(
    morphProject,
    changeTsExt,
    fileReplacer,
  );

  if (option === 'build') {
    return handleBuildOption(args.slice(1), aliasExtReplacer);
  }
}

main(process.argv.slice(2));
