import { Module } from 'node:module';
import ts from 'typescript';
import { dirname, extname, join, resolve as resolvePath, sep } from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import moduleAlias from 'module-alias';
import fs from 'node:fs';

const options = JSON.parse(process.env['XWTSC_OPTIONS']!) as ts.CompilerOptions;

options.sourceMap = false;

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

interface Module extends NodeModule {
  _extensions: {
    [key: string]: (module: ModuleType, filename: string) => void;
  };
}

const TypedModule = Module as unknown as Module;

function respectDynamicImport(code: string) {
  const regex = /((?:(require\()["'](\.{1,2}\/){1,}.*\.mts))/g;
  code = code.replace(regex, (match) => {
    return match.replace(/^require/, 'import');
  });
  return code;
}

function handleFileTranspilation(module: ModuleType, fileName: string) {
  const file = ts.sys.readFile(fileName, 'utf-8')!;

  const transpiled = ts.transpile(file, options, fileName, [], fileName);

  module._compile(respectDynamicImport(transpiled), fileName);
}

TypedModule._extensions['.ts'] = handleFileTranspilation;
TypedModule._extensions['.cts'] = handleFileTranspilation;

const baseURL = pathToFileURL(`${cwd()}${sep}`).href;

const extensionsRegex = /\.ts$|\.cts$|\.mts$/;

type ResolveContext = {
  conditions: string[];
  importAssertions: object;
  parentURL: string;
};

type NextResolve = (specifier: string) => Promise<void>;

const { paths = {}, baseUrl = cwd() } = options;

const moduleAliases: {
  multiFiles: Record<string, string[]>;
  singleFile: Record<string, string>;
} = {
  multiFiles: {},
  singleFile: {},
};
if (paths) {
  for (const i in paths) {
    if (i.endsWith('/*')) {
      const i_replace = i.replace('/*', '');
      const path_files = paths[i];
      if (path_files) {
        const p_files = [];
        for (const p of path_files) {
          const p_replace = p.replace('/*', '');
          const p_join = join(baseUrl, p_replace);
          moduleAlias.addAlias(i_replace, p_join);
          p_files.push(p_join);
        }
        moduleAliases.multiFiles[i_replace] = p_files;
      }
    } else {
      const path_join = join(baseUrl, paths[i]![0]!);
      moduleAlias.addAlias(i, path_join);
      moduleAliases.singleFile[i] = path_join;
    }
  }
}

export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
) {
  const { parentURL = baseURL } = context;
  if (extensionsRegex.test(specifier)) {
    for (const i in moduleAliases.multiFiles) {
      if (specifier.includes(i)) {
        const aliases = moduleAliases.multiFiles[i]!;
        for (const f of aliases) {
          const f_replace = specifier.replace(i, f);
          const f_exists = ts.sys.fileExists(f_replace);

          if (f_exists) {
            const url = new URL(f_replace, parentURL).href;
            return {
              shortCircuit: true,
              url,
            };
          } else continue;
        }
      }
    }

    return {
      shortCircuit: true,
      url: new URL(specifier, parentURL).href,
    };
  } else {
    for (const i in moduleAliases.singleFile) {
      if (specifier.includes(i)) {
        const url = new URL(moduleAliases.singleFile[i]!, parentURL).href;
        return {
          shortCircuit: true,
          url,
        };
      }
    }
  }

  return nextResolve(specifier);
}

type LoadContext = {
  format: string | undefined | null;
  importAssertions: object;
  conditions: string[];
};

type LoadReturn = {
  format: 'commonjs' | 'module' | 'builtin' | 'json' | 'wasm';
  shortCircuit: boolean;
  source?: string;
};

type NextLoad = (url: string, context: LoadContext) => LoadReturn;

export async function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): Promise<LoadReturn> {
  const format = getFormat(url);

  if (format === 'unknown') return nextLoad(url, context);

  if (format === 'commonjs') return { format, shortCircuit: true };

  const file = fs.readFileSync(fileURLToPath(url), 'utf-8');

  const compilerOptions = { ...options };

  compilerOptions.module = ts.ModuleKind.ESNext;

  const source = ts.transpile(file, compilerOptions, url, [], url);

  return { format, shortCircuit: true, source };
}

let packageFormat: 'commonjs' | 'module';
function getFormat(url: string): 'commonjs' | 'module' | 'unknown' {
  if (url.endsWith('.cts')) return 'commonjs';
  if (url.endsWith('.mts')) return 'module';
  if (url.endsWith('.ts')) {
    if (packageFormat) return packageFormat;

    packageFormat = getPackageFormat(url);

    return packageFormat;
  }

  return 'unknown';
}

function getPackageFormat(url: string): 'commonjs' | 'module' {
  const isFilePath = !!extname(url);

  const dir = isFilePath ? dirname(fileURLToPath(url)) : url;

  const packagePath = resolvePath(dir, 'package.json');

  const exists = fs.existsSync(packagePath);

  if (exists) {
    const file = fs.readFileSync(packagePath, 'utf-8');

    const type = JSON.parse(file).type || 'commonjs';

    return type;
  }

  if (dir.length > 1) {
    const behindFolder = resolvePath(dir, '..');
    return getPackageFormat(behindFolder);
  } else return 'commonjs';
}
