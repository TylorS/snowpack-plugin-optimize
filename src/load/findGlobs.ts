import { sync } from 'fast-glob'

export function findGlobs(cwd: string, globs: readonly string[]) {
  return globs.flatMap((x) => sync(x, { cwd }))
}
