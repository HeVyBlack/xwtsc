import {
  SourceFile,
  TransformTraversalControl,
  ts as morph,
  Project as MorphProject,
} from 'ts-morph';
import { SingleFileReplacer } from 'tsc-alias';
import ts from 'typescript';

export class ChangeTsExts {
  private readonly endsTsExt = /\.(m|c)?ts$/; // Ends with a ts extension
  private readonly relativePath = /^(\/|\.{1,2}\/)/; // Is relative or absulute;

  readonly inText = (text: string) => {
    if (this.relativePath.test(text) && this.endsTsExt.test(text)) {
      const newText = text.replace(/ts$/, 'js');

      return newText;
    }
    if (this.options) {
      const paths = this.options.paths;
      if (!paths) return text;

      for (const p in paths) {
        const pRegex = new RegExp(`^${p}$`); // Starts and ends

        if (!pRegex.test(text)) {
          const pRegex = new RegExp(`^${p}`); // Only starts
          if (pRegex.test(text) && this.endsTsExt.test(text)) {
            const newText = text.replace(/ts$/, 'js');
            return newText;
          }
        }
      }
    }

    return text;
  };

  readonly inStringLiteral = (string: morph.StringLiteral) => {
    const text = string.text;

    const newText = this.inText(text);

    const newString = morph.factory.createStringLiteral(newText, false);

    return newString;
  };

  readonly inArgs = (args: morph.NodeArray<morph.Expression>) => {
    const newArgs = [];
    for (const arg of args) {
      if (morph.isStringLiteral(arg)) {
        const newString = this.inStringLiteral(arg);
        newArgs.push(newString);
      }
    }

    return newArgs;
  };

  readonly inCallExpression = (call: morph.CallExpression) => {
    const firstChild = call.getChildAt(0);
    const getNewCall = () => {
      const args = call.arguments;

      const newArgs = this.inArgs(args);

      const newCall = morph.factory.updateCallExpression(
        call,
        call.expression,
        call.typeArguments,
        newArgs,
      );

      return newCall;
    };

    if (firstChild.kind === morph.SyntaxKind.ImportKeyword) return getNewCall();

    if (firstChild.getText() === 'require') return getNewCall();

    return call;
  };

  readonly inImportDeclaration = (imp: morph.ImportDeclaration) => {
    const moduleSpecifier = imp.moduleSpecifier;

    if (!morph.isStringLiteral(moduleSpecifier)) return imp;

    const newString = this.inStringLiteral(moduleSpecifier);
    const newImport = morph.factory.updateImportDeclaration(
      imp,
      imp.modifiers,
      imp.importClause,
      newString,
      imp.assertClause,
    );

    return newImport;
  };

  readonly inExportDeclaration = (exp: morph.ExportDeclaration) => {
    const moduleSpecifier = exp.moduleSpecifier;
    if (!moduleSpecifier) return exp;

    if (!morph.isStringLiteral(moduleSpecifier)) return exp;

    const newString = this.inStringLiteral(moduleSpecifier);
    const newExport = morph.factory.updateExportDeclaration(
      exp,
      exp.modifiers,
      exp.isTypeOnly,
      exp.exportClause,
      newString,
      exp.assertClause,
    );

    return newExport;
  };

  private options?: ts.CompilerOptions;

  readonly setOptions = (options: ts.CompilerOptions) => {
    this.options = options;
  };

  private readonly visitor = (node: TransformTraversalControl): morph.Node => {
    const child = node.visitChildren();
    if (morph.isCallExpression(child)) {
      const newChild = this.inCallExpression(child);
      return newChild;
    }

    if (morph.isImportDeclaration(child)) {
      const newChild = this.inImportDeclaration(child);
      return newChild;
    }

    if (morph.isExportDeclaration(child)) {
      const newChild = this.inExportDeclaration(child);
      return newChild;
    }

    return child;
  };

  readonly inSourceFile = (sourceFile: SourceFile) => {
    const transformed = sourceFile.transform(this.visitor);

    return transformed;
  };
}

export const morphReadFile = (
  morphProject: MorphProject,
  changeTsExt: ChangeTsExts,
) => {
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
};

export const morphWriteFile = (
  origWriteFile: ts.WriteFileCallback,
  fileReplacer: SingleFileReplacer,
): ts.WriteFileCallback => {
  return function (...args) {
    const [fileName, text, ...rest] = args;

    const newText = fileReplacer({
      fileContents: text,
      filePath: fileName,
    });

    return origWriteFile(fileName, newText, ...rest);
  };
};
