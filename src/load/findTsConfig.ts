import fs from 'fs'
import { basename, dirname, join } from 'path'
import ts from 'ttypescript'
import { CompilerOptions } from 'typescript'

import { diagnosticToString } from './diagnosticToString'

// TODO: add types for ttypescript plugins
export interface TsConfig {
  readonly compilerOptions: CompilerOptions
  readonly configPath: string
  readonly extends?: string | string[]
  readonly files?: string[]
  readonly include?: string[]
  readonly exclude?: string[]
}

/**
 * Find a TsConfig
 */
export function findTsConfig(cwd: string, configName: string): TsConfig {
  const configPath = ts.findConfigFile(
    cwd,
    (fileName: string) => fs.existsSync(fileName),
    configName,
  )

  if (!configPath) {
    throw new Error('Unable to find TypeScript configuration')
  }

  const baseConfig = parseConfigFile(cwd, configPath)

  if (baseConfig.extends) {
    const extensions = Array.isArray(baseConfig.extends) ? baseConfig.extends : [baseConfig.extends]
    const extendedConfigPaths = extensions.map((ext) => join(dirname(configPath), ext))
    const extendedConfigs = extendedConfigPaths.map((path) => parseConfigFile(cwd, path))

    if (extendedConfigs.length === 1) {
      return mergeConfigs(baseConfig, extendedConfigs[0])
    }

    return extendedConfigs.reduceRight(mergeConfigs, baseConfig)
  }

  return baseConfig
}

function mergeConfigs(base: TsConfig, extension: TsConfig): TsConfig {
  return {
    ...extension,
    ...base,
    compilerOptions: {
      ...extension.compilerOptions,
      ...base.compilerOptions,
    },
  }
}

function parseConfigFile(cwd: string, filePath: string): TsConfig {
  const fileName = basename(filePath)
  const contents = fs.readFileSync(filePath).toString()
  const { config } = ts.parseConfigFileTextToJson(filePath, contents)
  const { options, errors } = ts.convertCompilerOptionsFromJson(
    config.compilerOptions,
    cwd,
    fileName,
  )

  if (errors && errors.length > 0) {
    throw new Error(errors.map((x) => diagnosticToString(x, cwd)).join('\n'))
  }

  return { ...config, compilerOptions: options, configPath: filePath }
}
