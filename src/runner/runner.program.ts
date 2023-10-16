import ts from 'typescript';
import { initChild } from '../utils/child.js';
import { pathToFileURL } from 'url';
import { Program } from '../libs/typescript/ts.program.js';
import { reportDiagnostics } from '../libs/typescript/ts.utils.js';

export class Runner extends Program {
  constructor(
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

  public run() {
    const program = this.createProgram();

    const allDiagnostics = this.getDiagnostics(program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
    else {
      const tsOptions = program.getCompilerOptions();

      tsOptions.noEmit = false;
      tsOptions.noEmitOnError = false;

      const sourceFiles = program.getSourceFiles();

      const emitedFiles: Record<string, string> = {};

      for (const sourceFile of sourceFiles) {
        program.emit(sourceFile, (_, text) => {
          const fileName = sourceFile.fileName;
          const fileUrl = pathToFileURL(fileName).href;
          emitedFiles[fileUrl] = text;
        });
      }

      initChild(this.fileToRun, this.fileArgs, tsOptions, emitedFiles);
    }
  }
}
