import { Module } from 'node:module';
import ts from 'typescript';
import { dirname, extname, join, resolve as resolvePath, sep } from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import moduleAlias from 'module-alias';

const options = JSON.parse(process.env['XWTSC_OPTIONS']!) as ts.CompilerOptions;

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

function handleFileTranspilation(module: ModuleType, filename: string) {
  const file = ts.sys.readFile(filename, 'utf-8')!;
  const transpile = ts.transpileModule(file, {
    compilerOptions: {
      ...options,
      module: ts.ModuleKind.Node16,
    },
  });

  module._compile(respectDynamicImport(transpile['outputText']), filename);
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
  multi_files: Record<string, string[]>;
  single_file: Record<string, string>;
} = {
  multi_files: {},
  single_file: {},
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
        moduleAliases.multi_files[i_replace] = p_files;
      }
    } else {
      const path_join = join(baseUrl, paths[i]![0]!);
      moduleAlias.addAlias(i, path_join);
      moduleAliases.single_file[i] = path_join;
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
    for (const i in moduleAliases.multi_files) {
      if (specifier.includes(i)) {
        const aliases = moduleAliases.multi_files[i]!;
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
    for (const i in moduleAliases.single_file) {
      if (specifier.includes(i)) {
        const url = new URL(moduleAliases.single_file[i]!, parentURL).href;
        return {
          shortCircuit: true,
          url,
        };
      }
    }
  }

  return nextResolve(specifier);
}

type LoadContext = { format: string | undefined; importAssertions: object };

type NextLoad = (url: string) => Promise<void>;

export async function load(
  url: string,
  _context: LoadContext,
  nextLoad: NextLoad,
): Promise<{
  format: 'commonjs' | 'module';
  shortCircuit: boolean;
  source?: string;
} | void> {
  if (extensionsRegex.test(url)) {
    if (url.endsWith('.cts')) {
      return {
        format: 'commonjs',
        shortCircuit: true,
      };
    }

    if (url.endsWith('.mts')) {
      const file = ts.sys.readFile(fileURLToPath(url), 'utf-8') || '';

      const compilerOptions: ts.CompilerOptions = {
        ...options,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      };

      const { outputText } = ts.transpileModule(file, {
        compilerOptions,
      });

      return {
        format: 'module',
        shortCircuit: true,
        source: outputText,
      };
    }

    const format = getPackageType(url);

    if (format === 'commonjs') {
      return {
        format,
        shortCircuit: true,
      };
    }

    const file = ts.sys.readFile(fileURLToPath(url), 'utf-8') || '';

    const compilerOptions: ts.CompilerOptions = { ...options };

    if (format === 'module') {
      compilerOptions.module = ts.ModuleKind.ESNext;
      compilerOptions.target = ts.ScriptTarget.ESNext;
    }

    const { outputText } = ts.transpileModule(file, {
      compilerOptions,
    });

    return {
      format,
      shortCircuit: true,
      source: outputText,
    };
  }

  return nextLoad(url);
}

export function getPackageType(url: string): 'commonjs' | 'module' {
  const isFilePath = !!extname(url);

  const dir = isFilePath ? dirname(fileURLToPath(url)) : url;

  const packagePath = resolvePath(dir, 'package.json');

  const file = ts.sys.readFile(packagePath, 'utf-8')!;

  if (!file) {
    if (dir.length > 1) return getPackageType(resolvePath(dir, '..'));
    else return 'commonjs';
  }

  const type = JSON.parse(file).type || 'commonjs';

  return type;
}
