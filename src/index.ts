import csso from 'csso'
import { toList } from 'dependency-tree'
import { readFile } from 'fs/promises'
import htmlMinifier from 'html-minifier'
import { basename, extname, join, relative } from 'path'
import { SnowpackBuildMap, SnowpackConfig, SnowpackPlugin } from 'snowpack'
import { CompressOptions, minify, MinifyOptions } from 'terser'
import { gray, green, red, yellow } from 'typed-colors'
import { cross, tick } from 'typed-figures'
import { CustomTransformers, MapLike } from 'typescript'

import { generatePaths } from './generatePaths'
import { createLanguageService, findTsConfig, registerTsPaths } from './load'
import { parseHtml, querySelectorAll } from './parseHtml'
import { readAllFiles } from './readAllFiles'
import { writeAllFiles, WriteContent } from './writeAllFiles'

const jsFileExtensions = ['.js', '.jsx']
const prefix = gray('[snowpack-plugin-optimize]')
const info = (msg: string) => console.info(prefix, msg)
const headTagCloseRegex = new RegExp(`<(s+)?/(s+)?head(s+)?>`)

const plugin = (
  config: SnowpackConfig,
  pluginOptions: plugin.PluginOptions = {},
): SnowpackPlugin => {
  const nameCache: Record<string, unknown> = {}
  const {
    minifyCss = true,
    minifyHtml = true,
    minifyJs = true,
    modulePreload = true,
    tsConfigFileName = 'tsconfig.json',
    customTransformers,
  } = pluginOptions

  const plugin: SnowpackPlugin = {
    name: 'snowpack-plugin-optimize',
    optimize: async (options) => {
      // If there's noting to do, just return
      if (!minifyCss && !minifyHtml && !minifyJs && !modulePreload) {
        return
      }

      const { buildDirectory } = options
      const baseUrl = config.buildOptions.baseUrl
      const metaDir = join(buildDirectory, config.buildOptions.metaDir)
      const allFiles = readAllFiles(buildDirectory).filter((f) => !f.includes(metaDir))
      const writeFileContent = writeAllFiles(info)

      // Find all the files we know how to optimize
      const jsFiles = allFiles.filter((f) => jsFileExtensions.includes(extname(f)))
      const cssFiles = allFiles.filter((f) => extname(f) === '.css')
      const htmlFiles = allFiles.filter((f) => extname(f) === '.html')
      const allFilePaths = [...jsFiles, ...cssFiles, ...htmlFiles]

      if (allFilePaths.length === 0) {
        info(`${red(cross)} No supported files found to apply optimizations to.`)

        return
      }

      const promises: Promise<any>[] = []

      if (minifyJs && jsFiles.length > 0) {
        info(`${yellow('!')} Minifying JS files...`)

        const { jsOptions } = pluginOptions
        const minifyOptions: MinifyOptions = {
          module: true,
          toplevel: true,
          sourceMap: true,
          nameCache,
          ...jsOptions,
          compress:
            jsOptions?.compress === 'boolean'
              ? jsOptions.compress
              : {
                  ecma: 2019,
                  ...(jsOptions?.compress as CompressOptions),
                },
          format: {
            ecma: 2019,
            ...jsOptions?.format,
          },
        }

        promises.push(
          Promise.all(jsFiles.map((f) => minifyJsContent(f, minifyOptions))).then(writeFileContent),
        )
      }

      if (minifyCss && cssFiles.length > 0) {
        info(`${yellow('!')} Minifying CSS files...`)

        promises.push(
          Promise.all(cssFiles.map((f) => minifyCssContent(f, pluginOptions))).then(
            writeFileContent,
          ),
        )
      }

      if (modulePreload && htmlFiles.length > 0) {
        info(`${yellow('!')} Preloading modules...`)

        await Promise.all(
          htmlFiles.map(async (file) => {
            const paths = new Set(generatePaths(buildDirectory, baseUrl, jsFiles, file))
            const contents = await readFile(file).then((b) => b.toString())
            const nodes = await parseHtml(contents)
            const scripts = querySelectorAll('script', nodes)
            const srcs = scripts.map((s) => s.attribs.src!).filter((s) => paths.has(s))
            const links = srcs
              .flatMap((script) =>
                toList({ filename: join(buildDirectory, script), directory: buildDirectory }),
              )
              .map(
                (path) =>
                  `<link rel='modulepreload' href='${baseUrl}${relative(buildDirectory, path)}'/>`,
              )
              .join('')
            const headIndex = contents.search(headTagCloseRegex)
            const after =
              headIndex > -1
                ? `${contents.slice(0, headIndex)}${links}${contents.slice(headIndex)}`
                : contents

            const writeContent: WriteContent = {
              filePath: file,
              oldContent: contents,
              newContent: after,
            }

            return writeContent
          }),
        ).then(writeFileContent)
      }

      if (minifyHtml && htmlFiles.length > 0) {
        info(`${yellow('!')} Minifying HTML files...`)

        promises.push(
          Promise.all(htmlFiles.map((f) => minifyHtmlContent(f, pluginOptions))).then(
            writeFileContent,
          ),
        )
      }

      await Promise.all(promises)

      info(`${green(tick)} Complete!`)
    },
  }

  try {
    const cwd = process.cwd()
    const tsConfig = findTsConfig(cwd, tsConfigFileName)
    const files: MapLike<{ content: string; version: number }> = {}
    const service = createLanguageService(cwd, registerTsPaths(tsConfig.compilerOptions), files)

    plugin.resolve = {
      input: ['.ts', '.tsx'],
      output: ['.js', '.d.ts'],
    }

    plugin.load = async (options) => {
      // TODO: Should we support loading in dev mode?
      if (options.isDev) {
        return
      }

      const { filePath } = options

      if (!(filePath in files)) {
        files[filePath] = {
          content: '',
          version: 0,
        }
      }

      files[filePath].content = await readFile(filePath).then((b) => b.toString())
      files[filePath]!.version++

      const program = service.getProgram()!
      const sf = program.getSourceFile(filePath)
      const filesWritten: MapLike<string> = {}

      program.emit(
        sf,
        (filename, data) => (filesWritten[filename] = data),
        void 0,
        false,
        customTransformers,
      )

      const buildMap = filesToBuildMap(filesWritten)

      return buildMap
    }
  } catch (error) {
    console.info(`Unable to load TypeScript Files`)
  }

  return plugin
}

function filesToBuildMap(files: MapLike<string>): SnowpackBuildMap {
  const buildMap: SnowpackBuildMap = {
    '.js': {
      code: findExtension(files, '.js')!,
      map: findExtension(files, '.js.map'),
    },
    '.d.ts': {
      code: findExtension(files, '.d.ts')!,
      map: findExtension(files, '.d.ts.map'),
    },
  }

  if (!buildMap['.d.ts'].code) {
    delete buildMap['.d.ts']
  }

  return buildMap
}

function findExtension(files: MapLike<string>, extension: string) {
  const names = Object.keys(files)
  const match = names.find((n) => n.endsWith(extension))

  return match ? files[match] : undefined
}

const minifyJsContent = async (jsFile: string, minifyOptions: MinifyOptions) => {
  const contents = await readFile(jsFile).then((b) => b.toString())
  const output = await minify(contents, minifyOptions)
  const sourceMap = output.map?.toString()
  const content: WriteContent = {
    filePath: jsFile,
    oldContent: contents,
    newContent: output.code!,
    newSourceMap: sourceMap,
  }

  return content
}

const minifyCssContent = async (cssFile: string, pluginOptions: plugin.PluginOptions) => {
  const contents = await readFile(cssFile).then((b) => b.toString())
  const output = csso.minify(contents, {
    sourceMap: true,
    filename: basename(cssFile),
    ...pluginOptions.cssOptions,
  })
  const content: WriteContent = {
    filePath: cssFile,
    oldContent: contents,
    newContent: output.css,
    newSourceMap: output.map?.toString(),
  }

  return content
}

const minifyHtmlContent = async (htmlFile: string, pluginOptions: plugin.PluginOptions) => {
  const contents = await readFile(htmlFile).then((b) => b.toString())
  const output = htmlMinifier.minify(contents, {
    collapseWhitespace: true,
    keepClosingSlash: true,
    removeComments: true,
    ...pluginOptions.htmlOptions,
  })
  const content: WriteContent = {
    filePath: htmlFile,
    oldContent: contents,
    newContent: output,
  }

  return content
}

namespace plugin {
  export type PluginOptions = {
    readonly minifyJs?: boolean
    readonly jsOptions?: MinifyOptions
    readonly minifyCss?: boolean
    readonly cssOptions?: csso.MinifyOptions & csso.CompressOptions
    readonly minifyHtml?: boolean
    readonly htmlOptions?: htmlMinifier.Options
    readonly modulePreload?: boolean
    readonly tsConfigFileName?: string // Config name
    readonly customTransformers?: CustomTransformers
  }
}

export = plugin
