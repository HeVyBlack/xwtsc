import ts from 'typescript';
import { WatchProgram } from '../libs/typescript/ts.watcher.js';

export class WatchChecker extends WatchProgram {
  protected override extendedOptions: ts.CompilerOptions = {
    noEmit: true,
    allowImportingTsExtensions: true,
  };
}
