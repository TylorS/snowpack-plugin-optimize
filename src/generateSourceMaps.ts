import remapping from '@ampproject/remapping'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import MagicString from 'magic-string'
import { basename } from 'path'

export async function generateSourceMaps(
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

  // You might not have generated sourceMaps previously, so we'll at least generate one
  // For our own transformations.
  if (!existsSync(sourceMapPath)) {
    return nextSourceMapContents
  }

  const initialSourceMap = await readFile(sourceMapPath).then((b) => JSON.parse(b.toString()))

  if (initialSourceMap.sources.length === 0) {
    initialSourceMap.sources[0] = [filePath]
  }

  const updatedSourceMap = JSON.parse(nextSourceMapContents)
  const remapped = remapping([updatedSourceMap, initialSourceMap], () => null, false)

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

  let ms = new MagicString(beforeContent, {
    filename: basename(filePath),
    indentExclusionRanges: [],
  })

  ms = ms.overwrite(0, ms.length(), afterContent, { storeName: true, contentOnly: false })

  return ms
    .generateMap({
      hires: true,
      file: basename(filePath),
      source: beforeContent,
      includeContent: true,
    })
    .toString()
}
