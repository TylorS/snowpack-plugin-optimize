import { writeFile } from 'fs/promises'
import { EOL } from 'os'
import { extname, relative } from 'path'
import { cyan } from 'typed-colors'
import { info } from 'typed-figures'

import { generateSourceMaps } from './generateSourceMaps'

const pNull = Promise.resolve(null)
const sourceMapSupportedExtensions = ['.js', '.jsx', '.css']

export type WriteContent = {
  filePath: string
  oldContent: string
  newContent: string
  newSourceMap?: string
}

export const writeAllFiles = (log: (msg: string) => void, buildDirectory: string) => (
  filesToContent: ReadonlyArray<WriteContent>,
) =>
  Promise.all(
    filesToContent.map(async ({ filePath, oldContent, newContent, newSourceMap }) => {
      const ext = extname(filePath)
      const supportsSourceMaps = sourceMapSupportedExtensions.includes(ext)
      const url = sourceMapUrl(buildDirectory, filePath, ext)

      // Ensure we include the sourceMap in our files
      if (supportsSourceMaps && !newContent.includes(url)) {
        log(`${cyan(info)} Adding sourceMapUrl to ${relative(buildDirectory, filePath)}`)
        newContent = newContent + url
      }

      const remapped = supportsSourceMaps
        ? await generateSourceMaps(buildDirectory, filePath, oldContent, newContent, newSourceMap)
        : null

      await Promise.all([
        newContent ? writeFile(filePath, newContent) : pNull,
        supportsSourceMaps ? writeFile(filePath + '.map', remapped!) : Promise.resolve(),
      ])
    }),
  )

function sourceMapUrl(buildDirectory: string, filePath: string, ext: string) {
  return comment(ext, '/' + relative(buildDirectory, filePath) + '.map') + EOL
}

function comment(ext: string, path: string) {
  if (ext === '.css') {
    return `/*# sourceMappingURL=${path} */`
  }

  return `//# sourceMappingURL=${path}`
}
