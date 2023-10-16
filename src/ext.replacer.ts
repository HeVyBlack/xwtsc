import { Project as MorphProject } from 'ts-morph';
import { SingleFileReplacer } from 'tsc-alias';
import { ChangeTsExts } from './libs/morph/morph.change.js';

export class AliasExtReplacer {
  constructor(
    readonly morphProject: MorphProject,
    readonly changeTsExt: ChangeTsExts,
    readonly fileReplacer: SingleFileReplacer,
  ) {}
}
