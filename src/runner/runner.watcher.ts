import ts from 'typescript';
import { ChildInitialzer } from '../utils/child.js';
import { pathToFileURL } from 'url';
import { ChildProcess } from 'child_process';
import { WatchProgram } from '../libs/typescript/ts.watcher.js';

export class WatchRunner extends WatchProgram {
  constructor(
    private readonly childInitialzer: ChildInitialzer,
    configName: string,
  ) {
    super(configName);

    const signals = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
      process.on(signal, () => {
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

  private initChild(
    tsOptions: ts.CompilerOptions,
    emitedFiles: Record<string, string>,
  ) {
    if (this.child) this.child.kill();

    const child = this.childInitialzer.init(tsOptions, emitedFiles);

    this.child = child;
  }

  private getEmitedFiles(program: ts.Program): Record<string, string> {
    const sourceFiles = program.getSourceFiles();
    const emitedFiles: Record<string, string> = {};
    for (const sourceFile of sourceFiles) {
      program.emit(sourceFile, function (_, text) {
        const fileName = sourceFile.fileName;
        const fileUrl = pathToFileURL(fileName).href;
        emitedFiles[fileUrl] = text;
      });
    }

    return emitedFiles;
  }

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

        const emitedFiles = this.getEmitedFiles(program);

        tsOptions.noEmit = true;

        this.initChild(tsOptions, emitedFiles);
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
