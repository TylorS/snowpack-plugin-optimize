import { join } from 'path'
import { flattenDiagnosticMessageText } from 'ttypescript'
import type { Diagnostic } from 'typescript'

export function diagnosticsToString(diagnostics: readonly Diagnostic[], basePath: string): string {
  return diagnostics.map((x) => diagnosticToString(x, basePath)).join(`\n`)
}

export function diagnosticToString(diagnostic: Diagnostic, basePath: string): string {
  if (diagnostic.file) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
    const message = flattenDiagnosticMessageText(diagnostic.messageText, '\n')

    return (
      `${join(basePath, diagnostic.file.fileName)} (${line + 1},${character + 1}):` +
      `\n  ${message}`
    )
  }

  return `${flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
}
