import remapping from '@ampproject/remapping'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { basename } from 'path'

import { diffMagicString } from './diffMagicString'

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

  if (!initialSourceMap) {
    return nextSourceMapContents
  }

  if (initialSourceMap.sources.length === 0) {
    initialSourceMap.sources = [basename(filePath)]
  }

  const updatedSourceMap = JSON.parse(nextSourceMapContents)

  if (!updatedSourceMap || !updatedSourceMap.mapping) {
    return JSON.stringify(initialSourceMap)
  }

  if (updatedSourceMap.sources.length === 0) {
    updatedSourceMap.sources = [basename(filePath)]
  }

  try {
    const remapped = remapping([updatedSourceMap, initialSourceMap], () => null, false)

    return remapped.toString()
  } catch {
    console.info('Unable to remap source map', filePath)
    console.info('initial', initialSourceMap)
    console.info('updated', updatedSourceMap)

    return updatedSourceMap.mappings ? updatedSourceMap : initialSourceMap
  }
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

  return diffMagicString(basename(filePath), beforeContent, afterContent)[1]
}
