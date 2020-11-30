import csso from 'csso'
import { readFile } from 'fs/promises'
import htmlMinifier from 'html-minifier'
import { basename, extname, join } from 'path'
import { SnowpackConfig, SnowpackPlugin } from 'snowpack'
import { CompressOptions, minify, MinifyOptions } from 'terser'
import { gray, green, red, yellow } from 'typed-colors'
import { cross, tick } from 'typed-figures'

import { readAllFiles } from './readAllFiles'
import { writeAllFiles, WriteContent } from './writeAllFiles'

const jsFileExtensions = ['.js', '.jsx']
const prefix = gray('[snowpack-plugin-optimize]')

const info = (msg: string) => console.info(prefix, msg)

// TODO: Support module preloading
const plugin = (
  config: SnowpackConfig,
  pluginOptions: plugin.PluginOptions = {},
): SnowpackPlugin => {
  const nameCache: Record<string, unknown> = {}
  const { minifyCss = true, minifyHtml = true, minifyJs = true } = pluginOptions
  const plugin: SnowpackPlugin = {
    name: 'snowpack-plugin-optimize',
    optimize: async (options) => {
      if (!minifyCss && !minifyHtml && !minifyJs) {
        return
      }

      const { buildDirectory } = options
      const metaDir = join(buildDirectory, config.buildOptions.metaDir)
      const allFiles = readAllFiles(buildDirectory).filter((f) => !f.includes(metaDir))
      const writeFile = writeAllFiles(info, buildDirectory)

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

        await Promise.all(jsFiles.map((f) => minifyJsContent(f, minifyOptions))).then(writeFile)
      }

      if (minifyCss && cssFiles.length > 0) {
        info(`${yellow('!')} Minifying CSS files...`)

        await Promise.all(cssFiles.map((f) => minifyCssContent(f, pluginOptions))).then(writeFile)
      }

      if (minifyHtml && htmlFiles.length > 0) {
        info(`${yellow('!')} Minifying HTML files...`)

        await Promise.all(htmlFiles.map((f) => minifyHtmlContent(f, pluginOptions))).then(writeFile)
      }

      await Promise.all(promises)

      info(`${green(tick)} Complete!`)
    },
  }

  return plugin
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
  }
}

export = plugin
