import ts from 'typescript';

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
};

function formatDiagnostic(diagnostic: ts.Diagnostic) {
  const formated = ts.formatDiagnosticsWithColorAndContext(
    [diagnostic],
    formatHost,
  );

  return formated;
}

export function reportDiagnostic(diagnostic: ts.Diagnostic) {
  const formated = formatDiagnostic(diagnostic);

  console.error(formated);
}

let switchReport = true;
export function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
  if (switchReport) {
    console.clear();
    switchReport = false;
  } else switchReport = true;

  const formated = formatDiagnostic(diagnostic);

  console.info(formated);
}
