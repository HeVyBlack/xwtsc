import ts from 'typescript';
import {
  Program,
  WatchProgram,
  reportDiagnostics,
} from '../libs/typescript.js';
import { ChangeTsExts, morphReadFile, morphWriteFile } from '../libs/morph.js';
import { SingleFileReplacer } from 'tsc-alias';
import { Project as MorphProject } from 'ts-morph';

export class WatchChecker extends WatchProgram {
  constructor(
    private readonly fileReplacer: SingleFileReplacer,
    private readonly changeTsExt: ChangeTsExts,
    private readonly morphProject: MorphProject,
    configName: string,
  ) {
    super(configName);
  }

  protected override extendedOptions: ts.CompilerOptions = {
    noEmit: true,
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

export class Checker extends Program {
  constructor(
    protected readonly fileReplacer: SingleFileReplacer,
    protected readonly changeTsExt: ChangeTsExts,
    protected readonly morphProject: MorphProject,
    tsConfig: ts.CompilerOptions,
    fileNames: string[],
  ) {
    super(tsConfig, fileNames);
  }

  protected override extendTsConfig: ts.CompilerOptions = {
    noEmit: true,
    allowImportingTsExtensions: false,
    incremental: false,
  };

  protected override createHost(): ts.CompilerHost {
    const tsConfig = this.getTsConfig();
    this.changeTsExt.setOptions(tsConfig);

    const host = ts.createCompilerHost(tsConfig);

    host.readFile = morphReadFile(this.morphProject, this.changeTsExt);

    const origWriteFile = host.writeFile;
    host.writeFile = morphWriteFile(origWriteFile, this.fileReplacer);

    return host;
  }

  check() {
    const program = this.createProgram();

    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
  }
}
