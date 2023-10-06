import { dirname, extname, join, resolve as resolvePath } from 'node:path';
import { cwd, env } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import moduleAlias from 'module-alias';
import fs from 'node:fs';
import ts from 'typescript';
import module from 'node:module';

interface ModuleType {
  id: string;
  path: string;
  exports: object;
  filename: string;
  loaded: boolean;
  children: string[];
  paths: string[];
  _compile(code: string, filename: string): void;
}

interface ModuleTyped extends NodeModule {
  _extensions: {
    [key: string]: (module: ModuleType, filename: string) => void;
  };
}

const Module = module.Module as unknown as ModuleTyped;

type Env = {
  [key: string]: string | undefined;
};

type LoadReturn = Promise<{
  format: 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm';
  shortCircuit?: boolean;
  source?: string;
}>;

type LoadContext = {
  conditions: string[];
  format?: string;
  importAssertions: object;
};

type NextLoad = (specifier: string, context: LoadContext) => LoadReturn;

type ResolveContext = {
  conditions: string[];
  importAssertions: object;
  parentURL?: string;
};

type ResolveReturn = Promise<{
  format?: 'commonjs' | 'module';
  shortCircuit?: boolean;
  url: string;
}>;

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => Promise<ResolveReturn>;

class ModuleHooks {
  constructor(env: Env) {
    const XWTSC_EMITED_FILES = env['XWTSC_EMITED_FILES'];

    if (XWTSC_EMITED_FILES !== undefined) {
      this.emitedFiles = JSON.parse(XWTSC_EMITED_FILES);
    }

    const XWTSC_OPTIONS = env['XWTSC_OPTIONS'];

    if (XWTSC_OPTIONS !== undefined) {
      this.tsOptions = JSON.parse(XWTSC_OPTIONS);
    }

    const { paths, baseUrl = cwd() } = this.tsOptions;

    this.baseUrl = baseUrl;

    if (paths) {
      for (const index in paths) {
        const newIndex = index.replace('/*', '');
        let aliases = paths[index];

        if (!aliases) aliases = [];

        const newAliases = aliases.map((alias) => {
          const aliasReplaced = alias.replace('/*', '');
          const aliasJoin = join(baseUrl, aliasReplaced);
          moduleAlias.addAlias(newIndex, aliasJoin);
          return aliasReplaced;
        });

        this.pathAlias[newIndex] = newAliases;
      }
    }

    Module._extensions['.ts'] = this.moduleExtension.bind(this);
    Module._extensions['.cts'] = this.moduleExtension.bind(this);
  }

  private moduleExtension(module: ModuleType, fileName: string) {
    const url = pathToFileURL(fileName).href;

    const transpiled = this.transformTsFile(url);

    return module._compile(transpiled, fileName);
  }

  private readonly emitedFiles: Record<string, string> = {};
  private readonly tsOptions: ts.CompilerOptions = {};
  private readonly pathAlias: Record<string, string[]> = {};
  private readonly baseUrl: string;

  private readonly tsExtRgx = /\.(m|c)?ts$/;
  private readonly isPathRgx = /^(\/|\.\.\/|\.\/)/;
  private resolvePathAlias(specifier: string): {
    resolved: boolean;
    newUrl?: string;
  } {
    for (const index in this.pathAlias) {
      const aliasRegex = new RegExp(`^${index}`);

      if (!aliasRegex.test(specifier)) continue;

      let aliases = this.pathAlias[index] || [];

      for (const alias of aliases) {
        const newSpecifier = specifier.replace(index, alias);
        const newPath = join(this.baseUrl, newSpecifier);
        const pathExists = fs.existsSync(newPath);
        if (!pathExists) continue;

        const newUrl = pathToFileURL(newPath).href;

        return { resolved: true, newUrl };
      }
    }

    return { resolved: false };
  }

  async resolve(
    specifier: string,
    context: ResolveContext,
    nextResolve: NextResolve,
  ): ResolveReturn {
    const { parentURL } = context;
    const isPath = this.isPathRgx.test(specifier);
    let isTsExt = this.tsExtRgx.test(specifier);
    let format = this.getFormat(specifier);

    if (!parentURL) {
      if (!isTsExt) return nextResolve(specifier, context);

      if (format === 'unknown') return nextResolve(specifier, context);

      const url = new URL(specifier).href;
      return { format, url, shortCircuit: true };
    }

    if (isPath) {
      if (!isTsExt) return nextResolve(specifier, context);

      if (format === 'unknown') return nextResolve(specifier, context);

      const url = new URL(specifier, parentURL).href;
      return { format, url, shortCircuit: true };
    }

    const { resolved, newUrl = '' } = this.resolvePathAlias(specifier);

    if (resolved) {
      isTsExt = this.tsExtRgx.test(newUrl);
      if (!isTsExt) return nextResolve(specifier, context);

      format = this.getFormat(newUrl);
      if (format === 'unknown') return nextResolve(specifier, context);

      return { format, url: newUrl, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  }

  private transformTsFile(url: string): string {
    const emited = this.emitedFiles[url];
    if (emited) return emited;

    const exists = fs.existsSync(url);
    if (!exists) throw new Error(`${url} doesn't exist!`);

    const file = fs.readFileSync(url, 'utf-8')!;

    const transpiled = ts.transpile(file, this.tsOptions, url);

    return transpiled;
  }

  async load(
    url: string,
    context: LoadContext,
    nextLoad: NextLoad,
  ): LoadReturn {
    const format = this.getFormat(url);

    if (format === 'unknown') return nextLoad(url, context);
    if (format === 'commonjs') return { format, shortCircuit: true };

    const source = this.transformTsFile(url);

    return { format, source, shortCircuit: true };
  }

  private packageFormat?: 'commonjs' | 'module';
  private getFormat(url: string): 'commonjs' | 'module' | 'unknown' {
    if (url.endsWith('.cts')) return 'commonjs';
    if (url.endsWith('.mts')) return 'module';
    if (url.endsWith('.ts')) {
      if (this.packageFormat) return this.packageFormat;
      else this.packageFormat = this.getPackageFormat(url);

      return this.packageFormat;
    }

    return 'unknown';
  }

  private getPackageFormat(url: string): 'commonjs' | 'module' {
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

const moduleHooks = new ModuleHooks(env);

export const load = moduleHooks.load.bind(moduleHooks);
export const resolve = moduleHooks.resolve.bind(moduleHooks);
