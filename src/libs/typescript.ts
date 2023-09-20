import ts from 'typescript';

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
};

function formatDiagnostic(diagnostic: ts.Diagnostic) {
  const formated = ts.formatDiagnosticsWithColorAndContext(
    [diagnostic],
    formatHost,
  );

  return formated;
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  const formated = ts.formatDiagnosticsWithColorAndContext(
    diagnostics,
    formatHost,
  );

  return formated;
}

export function reportDiagnostic(diagnostic: ts.Diagnostic) {
  const formated = formatDiagnostic(diagnostic);

  console.error(formated);
}

let switchReport = true;
export function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
  if (switchReport) {
    console.clear();
    switchReport = false;
  } else switchReport = true;

  const formated = formatDiagnostic(diagnostic);

  console.info(formated);
}

export function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  const formated = formatDiagnostics(diagnostics);

  console.error(formated);
}

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

export abstract class WatchProgram {
  constructor(configName: string) {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, configName);
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    this.configPath = configPath;
  }

  protected readonly configPath: string;

  protected extendedOptions: ts.CompilerOptions = {};

  protected host?: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>;

  protected createHost() {
    const host = ts.createWatchCompilerHost(
      this.configPath,
      this.extendedOptions,
      ts.sys,
      ts.createEmitAndSemanticDiagnosticsBuilderProgram,
      reportDiagnostic,
      reportWatchStatusChanged,
    );

    return host;
  }

  protected setFirstHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ) {
    const origCreateProgram = host.createProgram;

    host.createProgram = (...args) => {
      return origCreateProgram(...args);
    };
  }

  protected setSecondHook(
    host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>,
  ) {
    const origAfterProgramCreate = host.afterProgramCreate;

    host.afterProgramCreate = (program) => {
      if (origAfterProgramCreate !== undefined)
        return origAfterProgramCreate(program);

      return;
    };
  }

  protected initWatcher() {
    const host = this.createHost();

    this.setFirstHook(host);

    this.setSecondHook(host);

    ts.createWatchProgram(host);
  }
}
