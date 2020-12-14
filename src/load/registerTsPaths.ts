import { createMatchPath } from 'tsconfig-paths'
import { CompilerOptions } from 'typescript'
import Module from 'module'

export function registerTsPaths(options: CompilerOptions): CompilerOptions {
  const { baseUrl, paths } = options

  if (baseUrl && paths) {
    const matchPath = createMatchPath(baseUrl, paths)
    // Patch node's module loading

    const originalResolveFilename = (Module as any)._resolveFilename

    ;(Module as any)._resolveFilename = function (request: any, _parent: any) {
      const found = matchPath(request)
      if (found) {
        // eslint-disable-next-line
        const modifiedArguments = [found].concat([].slice.call(arguments, 1)) // Passes all arguments. Even those that is not specified above.
        return originalResolveFilename.apply(this, modifiedArguments)
      }
      // eslint-disable-next-line
      return originalResolveFilename.apply(this, arguments)
    }
  }

  return options
}
