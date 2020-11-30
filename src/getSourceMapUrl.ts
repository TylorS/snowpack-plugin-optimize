import { EOL } from 'os'
import { basename } from 'path'

export function sourceMapUrl(filePath: string, ext: string) {
  return comment(ext, basename(filePath) + '.map') + EOL
}

export function comment(ext: string, path: string) {
  if (ext === '.css') {
    return `/*# sourceMappingURL=${path} */`
  }

  return `//# sourceMappingURL=${path}`
}
