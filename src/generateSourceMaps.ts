import remapping from '@ampproject/remapping'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import MagicString from 'magic-string'
import { basename, dirname, relative } from 'path'

export async function generateSourceMaps(
  _: string,
  filePath: string,
  beforeContent: string,
  afterContent: string,
  afterSourceMap?: string,
) {
  const sourceMapPath = filePath + '.map'
  const nextSourceMapContents = getNextSourceMap(
    filePath,
    beforeContent,
    afterContent,
    afterSourceMap,
  )
  const map = JSON.parse(nextSourceMapContents)

  if (!map.sources || map.sources.length !== 1) {
    map.sources = [filePath].map((p) =>
      p ? relative(dirname(filePath), relative(process.cwd(), p)) : p,
    )
    map.sourcesContent = [beforeContent]
  }

  const nextSourceMap = JSON.stringify(map)

  // You might not have generated sourceMaps previously, so we'll at least generate one
  // For our own transformations.
  if (!existsSync(sourceMapPath)) {
    return nextSourceMap
  }

  const initialSourceMap = await readFile(sourceMapPath).then((b) => JSON.parse(b.toString()))

  if (initialSourceMap.sources.length === 0) {
    initialSourceMap.sources[0] = [filePath]
  }

  const updatedSourceMap = JSON.parse(nextSourceMap)
  const remapped = remapping([updatedSourceMap, initialSourceMap], () => null, false)

  remapped.sources = remapped.sources.map((p) =>
    p ? relative(dirname(filePath), relative(process.cwd(), p)) : p,
  )

  return remapped.toString()
}

function getNextSourceMap(
  filePath: string,
  beforeContent: string,
  afterContent: string,
  afterSourceMap?: string,
) {
  if (afterSourceMap) {
    return afterSourceMap
  }

  const sourceMapPath = filePath + '.map'

  let ms = new MagicString(beforeContent, {
    filename: basename(filePath),
    indentExclusionRanges: [],
  })

  ms = ms.overwrite(0, ms.length(), afterContent, { storeName: true, contentOnly: false })

  return ms
    .generateMap({
      hires: true,
      file: basename(filePath),
      source: existsSync(sourceMapPath) ? void 0 : beforeContent,
      includeContent: true,
    })
    .toString()
}
