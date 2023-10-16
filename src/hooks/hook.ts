import { dirname, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ts from 'typescript';

export type Env = {
  [key: string]: string | undefined;
};

export abstract class Hook {
  protected readonly tsOptions: ts.CompilerOptions;

  constructor(protected readonly env: Env) {
    const XWTSC_OPTIONS = env['XWTSC_OPTIONS'];

    if (XWTSC_OPTIONS) this.tsOptions = JSON.parse(XWTSC_OPTIONS);
    else this.tsOptions = {};
  }

  private packageFormat?: 'commonjs' | 'module';
  protected getFormat(url: string): 'commonjs' | 'module' | 'unknown' {
    if (url.endsWith('.cts')) return 'commonjs';
    if (url.endsWith('.mts')) return 'module';
    if (url.endsWith('.ts')) {
      if (this.packageFormat) return this.packageFormat;
      else this.packageFormat = this.getPackageFormat(url);

      return this.packageFormat;
    }

    return 'unknown';
  }

  protected getPackageFormat(url: string): 'commonjs' | 'module' {
    const isFilePath = !!extname(url);

    let dir: string;
    if (isFilePath === true) dir = dirname(fileURLToPath(url));
    else dir = url;

    const packagePath = resolvePath(dir, 'package.json');

    const exists = fs.existsSync(packagePath);

    if (exists === true) {
      const packageJson = fs.readFileSync(packagePath, 'utf-8');

      const parsed = JSON.parse(packageJson);

      const { type = 'commonjs' } = parsed;

      return type;
    }

    if (dir.length > 1) {
      const behindFolder = resolvePath(dir, '..');
      return this.getPackageFormat(behindFolder);
    } else return 'commonjs';
  }
}
