import { SourceFile, TransformTraversalControl, ts as morph } from 'ts-morph';
import ts from 'typescript';

export class ChangeTsExts {
  private readonly relative_path = /^(\/|\.{1,2}\/)/;
  inStringLiteral = (string: morph.StringLiteral) => {
    const text = string.text;

    if (this.relative_path.test(text)) {
      const new_text = text.replace(/\.(m|c)?ts$/, (match) =>
        match.replace(/ts$/, 'js'),
      );

      const new_string = morph.factory.createStringLiteral(new_text, false);
      return new_string;
    } else if (this.options) {
      const paths = this.options.paths;
      if (!paths) return string;

      for (const p in paths) {
        const p_regex = new RegExp(`^${p}`);
        if (p_regex.test(text)) {
          const new_text = text.replace(/ts$/, 'js');
          const new_string = morph.factory.createStringLiteral(new_text, false);
          return new_string;
        }
      }
    }

    return string;
  };

  inArgs = (args: morph.NodeArray<morph.Expression>) => {
    const newArgs = [];
    for (const arg of args) {
      if (morph.isStringLiteral(arg)) {
        const new_string = this.inStringLiteral(arg);
        newArgs.push(new_string);
      }
    }

    return newArgs;
  };

  inCallExpression = (call: morph.CallExpression) => {
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

  inImportDeclaration = (imp: morph.ImportDeclaration) => {
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

  inExportDeclaration = (exp: morph.ExportDeclaration) => {
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

  setOptions(options: ts.CompilerOptions) {
    this.options = options;
  }

  private visitor = (node: TransformTraversalControl): morph.Node => {
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

  inSourceFile = (sourceFile: SourceFile) => {
    const transformed = sourceFile.transform(this.visitor);

    return transformed;
  };
}
