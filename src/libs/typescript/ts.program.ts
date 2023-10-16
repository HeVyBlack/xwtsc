import ts from 'typescript';
import { reportDiagnostics } from './ts.utils.js';

export abstract class Program {
  constructor(
    private readonly tsConfig: ts.CompilerOptions,
    private readonly fileNames: string[],
  ) {}

  static readTsConfig(tsConfigPath: string) {
    const { config } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);

    const { fileNames, options, errors } = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      process.cwd(),
    );

    if (errors.length) {
      reportDiagnostics(errors);
      process.exit(1);
    }

    return { fileNames, options };
  }

  protected extendTsConfig: ts.CompilerOptions = {};

  protected getTsConfig(): ts.CompilerOptions {
    return { ...this.tsConfig, ...this.extendTsConfig };
  }

  protected createHost() {
    const tsConfig = this.getTsConfig();

    const host = ts.createCompilerHost(tsConfig);

    return host;
  }

  protected createProgram() {
    const host = this.createHost();

    const tsConfig = this.getTsConfig();

    const program = ts.createProgram({
      options: tsConfig,
      rootNames: this.fileNames,
      host: host,
    });
    return program;
  }

  protected getDiagnostics(program: ts.Program) {
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    return allDiagnostics;
  }
}
