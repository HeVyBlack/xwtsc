import ts from 'typescript';
import { reportDiagnostics } from './ts.utils.js';

export function readTsConfig(tsConfigPath: string) {
  const { config } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);

  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());

  const { fileNames, options, errors, raw } = parsed;

  if (errors.length) {
    reportDiagnostics(errors);
    process.exit(1);
  }

  return { fileNames, options, raw };
}
