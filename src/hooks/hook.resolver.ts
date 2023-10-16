import { join } from 'node:path';
import { Env, Hook } from './hook.js';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { cwd } from 'node:process';
import { addAlias } from 'module-alias';

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

export class HookResolver extends Hook {
  private readonly baseUrl: string;
  private readonly pathAlias: Record<string, string[]> = {};

  constructor(env: Env) {
    super(env);
    const { paths, baseUrl = cwd() } = this.tsOptions;

    this.baseUrl = baseUrl;

    if (!paths) return;

    for (const path in paths) {
      const newPath = path.replace('/*', '');
      let aliases = paths[path];

      if (!aliases) aliases = [];

      const newAliases = aliases.map((alias) => {
        const aliasReplaced = alias.replace('/*', '');
        const aliasJoin = join(baseUrl, aliasReplaced);
        addAlias(newPath, aliasJoin);
        return aliasReplaced;
      });

      this.pathAlias[newPath] = newAliases;
    }
  }

  private readonly isTsExtRgx = /\.(m|c)?ts$/;
  private readonly isPathRgx = /^(\/|\.\.\/|\.\/)/;
  private resolvePathAlias(specifier: string): {
    resolved: boolean;
    newUrl?: string;
  } {
    for (const index in this.pathAlias) {
      const aliasRegex = new RegExp(`^${index}`);

      if (!aliasRegex.test(specifier)) continue;

      let aliases = this.pathAlias[index];

      if (!aliases) aliases = [];

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
    let isTsExt = this.isTsExtRgx.test(specifier);
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
      isTsExt = this.isTsExtRgx.test(newUrl);
      if (!isTsExt) return nextResolve(specifier, context);

      format = this.getFormat(newUrl);
      if (format === 'unknown') return nextResolve(specifier, context);

      return { format, url: newUrl, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  }
}
