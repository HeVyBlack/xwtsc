import ts from 'typescript';
import { reportDiagnostic, reportWatchStatusChanged } from './ts.utils.js';

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

  initWatcher() {
    const host = this.createHost();

    this.setFirstHook(host);

    this.setSecondHook(host);

    ts.createWatchProgram(host);
  }
}
