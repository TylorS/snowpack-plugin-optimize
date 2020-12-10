import { dirname, relative } from 'path'

import { makeAbsolute } from './makeAbsolute'

export function generatePaths(
  buildDirectory: string,
  baseUrl: string,
  files: ReadonlyArray<string>,
  filePath: string,
): ReadonlyArray<string> {
  return files.flatMap(applyRemounts(buildDirectory, baseUrl, filePath))
}

function applyRemounts(buildDirectory: string, baseUrl: string, path: string) {
  return (file: string): ReadonlyArray<string> => {
    return [
      baseUrl + absoluteRemount(buildDirectory, file),
      ensureRelative(relative(dirname(path), makeAbsolute(buildDirectory, file))),
    ]
  }
}

function absoluteRemount(buildDirectory: string, path: string): string {
  return relative(buildDirectory, path)
}

function ensureRelative(path: string): string {
  if (path[0] === '.') {
    return path
  }

  return './' + path
}
