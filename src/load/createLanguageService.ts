import { existsSync, readFileSync } from 'fs'
import micromatch from 'micromatch'
import { isAbsolute, join, relative } from 'path'
import ts from 'ttypescript'
import { CompilerOptions, LanguageService, LanguageServiceHost, MapLike } from 'typescript'

import { makeAbsolute } from '../makeAbsolute'

export function createLanguageService(
  cwd: string,
  compilerOptions: CompilerOptions,
  files: MapLike<{ content: string; version: number }>,
): LanguageService {
  const servicesHost: LanguageServiceHost = {
    getScriptFileNames: () => Object.keys(files),
    getScriptVersion: (fileName) => {
      const key = isAbsolute(fileName) ? fileName : join(cwd, fileName)

      return files[key] && files[key].version.toString()
    },
    getScriptSnapshot: (fileName) => {
      const pathname = makeAbsolute(cwd, fileName)

      if (!existsSync(pathname)) {
        return undefined
      }

      return ts.ScriptSnapshot.fromString(readFileSync(pathname).toString())
    },
    getCurrentDirectory: () => cwd,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (p) => p in files,
    readFile: (p) => files[p].content,
    readDirectory: (
      path,
      extensions = ['.ts', '.tsx'],
      exclude = [],
      include = ['*.ts'],
      depth = Infinity,
    ) => {
      const filePaths = Object.keys(files)
      const inDirectory = filePaths.filter((p) => p.includes(path))
      const matching = micromatch(inDirectory, [
        ...exclude.map((p) => `!${p}`),
        ...include,
        ...extensions.map((e) => `*${e}`),
      ])

      return matching.filter((p) => {
        const rp = relative(path, p)
        const d = rp.split(/\//g).filter(Boolean).length

        return d <= depth
      })
    },
  }

  return ts.createLanguageService(servicesHost, ts.createDocumentRegistry())
}
