import { writeFile } from 'fs/promises'
import { dirname, extname, relative } from 'path'
import { cyan } from 'typed-colors'
import { info } from 'typed-figures'

import { generateSourceMaps } from './generateSourceMaps'
import { sourceMapUrl } from './getSourceMapUrl'

const pNull = Promise.resolve(null)
const sourceMapSupportedExtensions = ['.js', '.jsx', '.css']

export type WriteContent = {
  filePath: string
  oldContent: string
  newContent: string
  newSourceMap?: string
}

export const writeAllFiles = (log: (msg: string) => void) => (
  filesToContent: ReadonlyArray<WriteContent>,
) =>
  Promise.all(
    filesToContent.map(async ({ filePath, oldContent, newContent, newSourceMap }) => {
      const ext = extname(filePath)
      const supportsSourceMaps = sourceMapSupportedExtensions.includes(ext)
      const url = sourceMapUrl(filePath, ext)

      // Ensure we include the sourceMap in our files
      if (supportsSourceMaps && !newContent.includes(url)) {
        log(`${cyan(info)} Adding sourceMapUrl to ${relative(process.cwd(), filePath)}`)
        newContent = newContent + url
      }

      const remapped = supportsSourceMaps
        ? await generateSourceMaps(filePath, oldContent, newContent, newSourceMap).then(
            rewriteSources(filePath),
          )
        : null

      await Promise.all([
        newContent ? writeFile(filePath, newContent) : pNull,
        supportsSourceMaps ? writeFile(filePath + '.map', remapped!) : Promise.resolve(),
      ])
    }),
  )

function rewriteSources(filePath: string) {
  return async (sourceMap: string) => {
    const map = JSON.parse(sourceMap)

    map.sources = map.sources.map((source: string) => relative(dirname(filePath), source))

    return JSON.stringify(map, null, 2)
  }
}
