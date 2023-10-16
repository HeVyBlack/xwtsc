import { SingleFileReplacer } from 'tsc-alias';
import { ChangeTsExts } from '../libs/morph/morph.change.js';
import {
  morphReadFile,
  morphWriteFile,
} from '../libs/morph/morph.functions.js';
import { AliasExtReplacer } from '../ext.replacer.js';
import ts from 'typescript';
import { Project as MorphProject } from 'ts-morph';
import { WatchProgram } from '../libs/typescript/ts.watcher.js';

export class WatchBuilder extends WatchProgram {
  private readonly fileReplacer: SingleFileReplacer;
  private readonly changeTsExt: ChangeTsExts;
  private readonly morphProject: MorphProject;
  constructor(aliasExtReplacer: AliasExtReplacer, configName: string) {
    super(configName);
    this.fileReplacer = aliasExtReplacer.fileReplacer;
    this.changeTsExt = aliasExtReplacer.changeTsExt;
    this.morphProject = aliasExtReplacer.morphProject;
  }

  protected override extendedOptions: ts.CompilerOptions = {
    noEmit: false,
    allowImportingTsExtensions: false,
  };

  protected override setFirstHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ) {
    const origCreateProgram = host.createProgram;

    host.createProgram = (...args) => {
      const [, options, host] = args;

      if (options) this.changeTsExt.setOptions(options);

      if (host) {
        host.readFile = morphReadFile(this.morphProject, this.changeTsExt);

        const origWriteFile = host.writeFile;
        host.writeFile = morphWriteFile(origWriteFile, this.fileReplacer);
      }

      return origCreateProgram(...args);
    };
  }

  override initWatcher() {
    const host = this.createHost();

    this.setFirstHook(host);

    ts.createWatchProgram(host);
  }
}
