import ts from 'typescript';
import { Program } from '../libs/typescript/ts.program.js';
import { reportDiagnostics } from '../libs/typescript/ts.utils.js';

export class Checker extends Program {
  protected override extendTsConfig: ts.CompilerOptions = {
    noEmit: true,
    allowImportingTsExtensions: true,
    incremental: false,
  };

  check() {
    const program = this.createProgram();

    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    if (allDiagnostics.length) reportDiagnostics(allDiagnostics);
  }
}
