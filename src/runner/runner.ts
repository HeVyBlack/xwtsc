import ts from 'typescript';
import {
  Program,
  WatchProgram,
  reportDiagnostics,
} from '../libs/typescript.js';
import { ChangeTsExts } from '../libs/morph.js';
import { Project as MorphProject } from 'ts-morph';
import path from 'path';
import { initChild } from '../utils/child.js';
import { platform } from 'os';
import { pathToFileURL } from 'url';
import { ChildProcess } from 'child_process';

export class WatchRunner extends WatchProgram {
  constructor(
    _changeTsExt: ChangeTsExts,
    _morphProject: MorphProject,
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
    allowImportingTsExtensions: true,
    declaration: false,
    sourceMap: false,
    incremental: false,
    noEmitOnError: false,
  };

  protected override setFirstHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ) {
    const origCreateProgram = host.createProgram;

    host.createProgram = (...args) => {
      if (this.child !== undefined) this.child.kill();

      return origCreateProgram(...args);
    };
  }

  private child?: ChildProcess;

  protected override setSecondHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ): void {
    const origAfterProgramCreate = host.afterProgramCreate;

    host.afterProgramCreate = (buildProgram) => {
      const program = buildProgram.getProgram();
      const allDiagnostics = ts.getPreEmitDiagnostics(program);

      if (!allDiagnostics.length) {
        const tsOptions = program.getCompilerOptions();

        tsOptions.noEmit = false;

        const sourceFiles = program.getSourceFiles();

        const emitedFiles: Record<string, string> = {};

        for (const sourceFile of sourceFiles) {
          program.emit(sourceFile, (_, text) => {
            const fileName = sourceFile.fileName;
            const fileUrl = pathToFileURL(fileName).href;
            emitedFiles[fileUrl] = text;
          });
        }

        tsOptions.noEmit = true;

        if (this.child === undefined)
          this.child = initChild(
            this.fileToRun,
            this.fileArgs,
            tsOptions,
            emitedFiles,
          );
        else {
          this.child.kill();
          this.child = initChild(
            this.fileToRun,
            this.fileArgs,
            tsOptions,
            emitedFiles,
          );
        }
      }
      
      if (origAfterProgramCreate) return origAfterProgramCreate(buildProgram);
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
    _changeTsExt: ChangeTsExts,
    _: MorphProject,
    private readonly fileToRun: string,
    private readonly fileArgs: string[],
    tsConfig: ts.CompilerOptions,
    fileNames: string[],
  ) {
    super(tsConfig, fileNames);
  }

  protected override extendTsConfig: ts.CompilerOptions = {
    noEmit: true,
    allowImportingTsExtensions: true,
    declaration: false,
    sourceMap: false,
    incremental: false,
    noEmitOnError: false,
  };

  protected override createHost(): ts.CompilerHost {
    const tsConfig = this.getTsConfig();

    const host = ts.createCompilerHost(tsConfig);

    return host;
  }

  private program?: ts.Program;
  private child?: ChildProcess;
  public async run() {
    this.program = this.createProgram();

    const allDiagnostics = this.getDiagnostics(this.program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
    else {
      const tsOptions = this.program.getCompilerOptions();

      tsOptions.noEmit = false;
      tsOptions.noEmitOnError = false;

      const sourceFiles = this.program.getSourceFiles();

      const emitedFiles: Record<string, string> = {};

      for (const sourceFile of sourceFiles) {
        this.program.emit(sourceFile, (_, text) => {
          const fileName = sourceFile.fileName;
          const fileUrl = pathToFileURL(fileName).href;
          emitedFiles[fileUrl] = text;
        });
      }

      if (this.child === undefined) {
        this.child = initChild(
          this.fileToRun,
          this.fileArgs,
          tsOptions,
          emitedFiles,
        );
      } else {
        this.child.kill();
        this.child = initChild(
          this.fileToRun,
          this.fileArgs,
          tsOptions,
          emitedFiles,
        );
      }
    }
  }
}

export const runnerHooksPath =
  platform() === 'win32'
    ? path.join(pathToFileURL(__dirname).href, 'hooks.mjs')
    : path.join(__dirname, 'hooks.mjs');
