import { SingleFileReplacer } from 'tsc-alias';
import { ChangeTsExts } from '../libs/morph.js';
import ts from 'typescript';
import {
  reportDiagnostic,
  reportWatchStatusChanged,
} from '../libs/typescript.js';
import { Project as MorphProject } from 'ts-morph';

export class WatchChecker {
  constructor(
    private readonly fileReplacer: SingleFileReplacer,
    private readonly changeTsExt: ChangeTsExts,
    private readonly morphProject: MorphProject,
    configName: string,
  ) {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, configName);
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }

    this.host = ts.createWatchCompilerHost(
      configPath,
      {
        noEmit: false,
        allowImportingTsExtensions: false,
      },
      ts.sys,
      ts.createEmitAndSemanticDiagnosticsBuilderProgram,
      reportDiagnostic,
      reportWatchStatusChanged,
    );
  }

  private host: ts.WatchCompilerHostOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram>;

  private readFile = (path: string, encoding: string = 'utf-8') => {
    const file = ts.sys.readFile(path, encoding);

    if (file !== undefined) {
      const sourceFile = this.morphProject.createSourceFile(path, file, {
        overwrite: true,
      });

      const transformed = this.changeTsExt.inSourceFile(sourceFile);

      return transformed.getFullText();
    } else return file;
  };

  initWatcher() {
    const origCreateProgram = this.host.createProgram;

    this.host.createProgram = (...args) => {
      const [, options, host] = args;

      if (options) this.changeTsExt.setOptions(options);

      if (host) {
        host.readFile = this.readFile;

        const origWriteFile = host.writeFile;
        host.writeFile = (...args) => {
          const [fileName, text, ...rest] = args;

          const newText = this.fileReplacer({
            fileContents: text,
            filePath: fileName,
          });

          return origWriteFile(fileName, newText, ...rest);
        };
      }

      return origCreateProgram(...args);
    };

    ts.createWatchProgram(this.host);
  }
}

export class Chcker {
  constructor(
    private readonly fileReplacer: SingleFileReplacer,
    private readonly changeTsExt: ChangeTsExts,
    private readonly morphProject: MorphProject,
    configName: string,
  ) {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, configName);
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }

    this.host = ts.createWatchCompilerHost(
      configPath,
      {
        noEmit: true,
        allowImportingTsExtensions: false,
      },
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      reportDiagnostic,
      () => {},
    );
  }

  private host: ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;

  private readFile = (path: string, encoding: string = 'utf-8') => {
    const file = ts.sys.readFile(path, encoding);

    if (file !== undefined) {
      const sourceFile = this.morphProject.createSourceFile(path, file, {
        overwrite: true,
      });

      const transformed = this.changeTsExt.inSourceFile(sourceFile);

      return transformed.getFullText();
    } else return file;
  };

  init() {
    const origCreateProgram = this.host.createProgram;

    this.host.createProgram = (...args) => {
      const [, options, host] = args;

      if (options) this.changeTsExt.setOptions(options);

      if (host) {
        host.readFile = this.readFile;

        const origWriteFile = host.writeFile;
        host.writeFile = (...args) => {
          const [fileName, text, ...rest] = args;

          const newText = this.fileReplacer({
            fileContents: text,
            filePath: fileName,
          });

          return origWriteFile(fileName, newText, ...rest);
        };
      }

      return origCreateProgram(...args);
    };

    const origAfterProgramCreate = this.host.afterProgramCreate;

    this.host.afterProgramCreate = function (program) {
      if (origAfterProgramCreate) origAfterProgramCreate(program);
      process.exit(0);
    };

    ts.createWatchProgram(this.host);
  }
}
