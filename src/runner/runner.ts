import ts from 'typescript';
import {
  Program,
  WatchProgram,
  reportDiagnostics,
} from '../libs/typescript.js';
import { ChangeTsExts, morphReadFile } from '../libs/morph.js';
import { Project as MorphProject } from 'ts-morph';
import path from 'path';
import { initChild } from '../utils/child.js';
import { platform } from 'os';
import { pathToFileURL } from 'url';
import { ChildProcess } from 'child_process';

export class WatchRunner extends WatchProgram {
  constructor(
    private readonly changeTsExt: ChangeTsExts,
    private readonly morphProject: MorphProject,
    private readonly fileToRun: string,
    private readonly fileArgs: string[],
    configName: string,
  ) {
    super(configName);

    const signals = ['SIGTERM', 'SIGINT'];

    for (const s of signals) {
      process.on(s, () => {
        if (this.child) this.child.kill();
        if (this.program) this.program.close();
        process.exit(0);
      });
    }
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

      if (this.child !== undefined) this.child.kill();

      if (options) this.changeTsExt.setOptions(options);

      if (host) {
        host.readFile = morphReadFile(this.morphProject, this.changeTsExt);
      }

      return origCreateProgram(...args);
    };
  }

  private child?: ChildProcess;

  protected override setSecondHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ): void {
    const origAfterProgramCreate = host.afterProgramCreate;

    host.afterProgramCreate = (program) => {
      const allDiagnostics = ts.getPreEmitDiagnostics(program.getProgram());

      if (!allDiagnostics.length) {
        const tsOptions = program.getCompilerOptions();

        if (this.child === undefined)
          this.child = initChild(this.fileToRun, this.fileArgs, tsOptions);
        else {
          this.child.kill();
          this.child = initChild(this.fileToRun, this.fileArgs, tsOptions);
        }
      }
      if (origAfterProgramCreate) return origAfterProgramCreate(program);
    };
  }

  private program?: ts.WatchOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>;
  override initWatcher() {
    const host = this.createHost();

    this.setFirstHook(host);

    this.setSecondHook(host);

    this.program = ts.createWatchProgram(host);
  }
}

export class Runner extends Program {
  constructor(
    private readonly changeTsExt: ChangeTsExts,
    private readonly morphProject: MorphProject,
    private readonly fileToRun: string,
    private readonly fileArgs: string[],
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

    return host;
  }

  private program?: ts.Program;
  private child?: ChildProcess;
  public run() {
    this.program = this.createProgram();

    const allDiagnostics = this.getDiagnostics(this.program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
    else {
      const tsOptions = this.program.getCompilerOptions();
      if (this.child === undefined)
        this.child = initChild(this.fileToRun, this.fileArgs, tsOptions);
      else {
        this.child.kill();
        this.child = initChild(this.fileToRun, this.fileArgs, tsOptions);
      }
    }
  }
}

export const runnerHooksPath =
  platform() === 'win32'
    ? path.join(pathToFileURL(__dirname).href, 'hooks.mjs')
    : path.join(__dirname, 'hooks.mjs');
