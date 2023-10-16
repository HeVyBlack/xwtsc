import { Env, Hook } from './hook.js';
import fs from 'node:fs';
import ts from 'typescript';
import module from 'node:module';
import { pathToFileURL } from 'node:url';

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

export class HookLoader extends Hook {
  private readonly emitedFiles: Record<string, string> = {};

  constructor(env: Env) {
    super(env);
    const XWTSC_EMITED_FILES = env['XWTSC_EMITED_FILES'];

    if (XWTSC_EMITED_FILES) this.emitedFiles = JSON.parse(XWTSC_EMITED_FILES);

    Module._extensions['.ts'] = this.moduleExtension.bind(this);
    Module._extensions['.cts'] = this.moduleExtension.bind(this);
  }

  private moduleExtension(module: ModuleType, fileName: string) {
    const url = pathToFileURL(fileName).href;

    const transpiled = this.transformTsFile(url);

    return module._compile(transpiled, fileName);
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
}
