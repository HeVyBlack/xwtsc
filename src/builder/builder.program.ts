import { SingleFileReplacer } from 'tsc-alias';
import { ChangeTsExts } from '../libs/morph/morph.change.js';
import {
  morphReadFile,
  morphWriteFile,
} from '../libs/morph/morph.functions.js';
import { AliasExtReplacer } from '../ext.replacer.js';
import ts from 'typescript';
import { Project as MorphProject } from 'ts-morph';
import { Program } from '../libs/typescript/ts.program.js';
import { reportDiagnostics } from '../libs/typescript/ts.utils.js';

export class Builder extends Program {
  protected readonly fileReplacer: SingleFileReplacer;
  protected readonly changeTsExt: ChangeTsExts;
  protected readonly morphProject: MorphProject;
  constructor(
    aliasExtReplacer: AliasExtReplacer,
    tsConfig: ts.CompilerOptions,
    fileNames: string[],
  ) {
    super(tsConfig, fileNames);
    this.fileReplacer = aliasExtReplacer.fileReplacer;
    this.changeTsExt = aliasExtReplacer.changeTsExt;
    this.morphProject = aliasExtReplacer.morphProject;
  }

  protected override extendTsConfig: ts.CompilerOptions = {
    noEmit: false,
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

  public build() {
    const program = this.createProgram();

    const allDiagnostics = this.getDiagnostics(program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
    else {
      const emitDiagsnostics = program.emit().diagnostics;
      if (emitDiagsnostics.length) reportDiagnostics(emitDiagsnostics);
    }
  }
}
