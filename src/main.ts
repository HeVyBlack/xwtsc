#!/usr/bin/env node
process.env['IS_XWTSC'] = 'true';

import { Project as MorphProject } from 'ts-morph';
import { ChangeTsExts } from './libs/morph.js';
import { prepareSingleFileReplaceTscAliasPaths } from 'tsc-alias';
import { Builder, WatchBuilder } from './builder/builder.js';

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
      } else
        new Builder(
          fileReplacer,
          changeTsExt,
          morphProject,
          tsConfigPath,
        ).init();
    }
  }
}

main(process.argv.slice(2));
