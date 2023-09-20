#!/usr/bin/env node
process.env['IS_XWTSC'] = 'true';

import { Project as MorphProject } from 'ts-morph';
import { ChangeTsExts } from './libs/morph.js';
import { prepareSingleFileReplaceTscAliasPaths } from 'tsc-alias';
import { Builder, WatchBuilder } from './builder/builder.js';
import { Checker, WatchChecker } from './checker/checker.js';
import { Runner, WatchRunner } from './runner/runner.js';

async function main(args: string[]) {
  const option = args[0];

  const verb = args[1];

  if (option) {
    let tsConfigPath = './tsconfig.json';
    if (args.includes('--tsconfig')) {
      const index = args.indexOf('--tsconfig') + 1;
      const aux = args[index];
      if (!aux) throw new Error('Provied a valid tsconfig!');
      tsConfigPath = aux;
    }

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

    const changeTsExt = new ChangeTsExts();

    const fileReplacer = await prepareSingleFileReplaceTscAliasPaths({
      configFile: tsConfigPath,
      resolveFullPaths: true,
    });

    if (option === 'build') {
      if (verb && verb === 'watch') {
        const watchBuilder = new WatchBuilder(
          fileReplacer,
          changeTsExt,
          morphProject,
          tsConfigPath,
        );

        watchBuilder.initWatcher();
      } else {
        const { fileNames, options } = Builder.readTsConfig(tsConfigPath);

        const builder = new Builder(
          fileReplacer,
          changeTsExt,
          morphProject,
          options,
          fileNames,
        );

        builder.build();
      }
    }

    if (option === 'check') {
      if (verb && verb === 'watch') {
        const watchBuilder = new WatchChecker(
          changeTsExt,
          morphProject,
          tsConfigPath,
        );

        watchBuilder.initWatcher();
      } else {
        const { fileNames, options } = Checker.readTsConfig(tsConfigPath);
        const checker = new Checker(
          fileReplacer,
          changeTsExt,
          morphProject,
          options,
          fileNames,
        );

        checker.check();
      }
    }

    if (option === 'run') {
      if (verb && verb === 'watch') {
        const fileToRun = args[2];
        if (!fileToRun) throw new Error('File to run needed!');

        const fileArgs: string[] = [];

        if (args.includes('--args=')) {
          const index = args.indexOf('--args=') + 1;
          const auxArgs = args.slice(index);

          for (const a of auxArgs) {
            fileArgs.push(a);
          }
        }

        const watchBuilder = new WatchRunner(
          changeTsExt,
          morphProject,
          fileToRun,
          fileArgs,
          tsConfigPath,
        );

        watchBuilder.initWatcher();
      } else {
        const fileToRun = verb;
        if (!fileToRun) throw new Error('File to run needed!');

        const fileArgs: string[] = [];

        if (args.includes('--args=')) {
          const index = args.indexOf('--args=') + 1;
          const auxArgs = args.slice(index);

          for (const a of auxArgs) {
            fileArgs.push(a);
          }
        }

        const { fileNames, options } = Runner.readTsConfig(tsConfigPath);
        const runner = new Runner(
          changeTsExt,
          morphProject,
          fileToRun,
          fileArgs,
          options,
          fileNames,
        );

        runner.run();
      }
    }
  }
}

main(process.argv.slice(2));
