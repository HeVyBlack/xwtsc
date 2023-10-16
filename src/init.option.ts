import fs from 'node:fs';
import { rawTsConfig } from './libs/typescript/ts.variables.js';
import { exitWarn } from './utils/log.js';

export function handleInitOption() {
  const tsConfigPath = './tsconfig.json';

  const exists = fs.existsSync(tsConfigPath);

  if (exists) return exitWarn('tsconfig already exists!');

  const stringify = JSON.stringify(rawTsConfig, undefined, 2) + '\n';

  fs.writeFileSync('./tsconfig.json', stringify, {
    encoding: 'utf-8',
  });
}
