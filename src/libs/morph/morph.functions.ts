import { Project as MorphProject } from 'ts-morph';
import { SingleFileReplacer } from 'tsc-alias';
import ts from 'typescript';
import { ChangeTsExts } from './morph.change.js';

export function morphReadFile(
  morphProject: MorphProject,
  changeTsExt: ChangeTsExts,
) {
  return function (path: string, encoding: string = 'utf-8') {
    const file = ts.sys.readFile(path, encoding);

    if (file !== undefined) {
      const sourceFile = morphProject.createSourceFile(path, file, {
        overwrite: true,
      });

      const transformed = changeTsExt.inSourceFile(sourceFile);
      return transformed.getFullText();
    } else return file;
  };
}

export function morphWriteFile(
  origWriteFile: ts.WriteFileCallback,
  fileReplacer: SingleFileReplacer,
): ts.WriteFileCallback {
  return function (...args) {
    const [fileName, text, ...rest] = args;

    const newText = fileReplacer({
      fileContents: text,
      filePath: fileName,
    });

    return origWriteFile(fileName, newText, ...rest);
  };
}
