import { EOL } from 'os'
import { relative } from 'path'

export function sourceMapUrl(buildDirectory: string, filePath: string, ext: string) {
  return comment(ext, '/' + relative(buildDirectory, filePath) + '.map') + EOL
}

export function comment(ext: string, path: string) {
  if (ext === '.css') {
    return `/*# sourceMappingURL=${path} */`
  }

  return `//# sourceMappingURL=${path}`
}
