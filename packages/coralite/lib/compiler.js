import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createContext } from 'node:vm'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { extractGlobals } from './server-utils.js'
import { CoraliteError } from './errors.js'

/**
 * @import { CoraliteModule, CoraliteModuleDefinitions, CoralitePage, CoraliteSession, CoraliteFilePath, CoralitePluginContext } from '../types/index.js'
 * @import { Module } from 'node:vm'
 */

let SourceTextModuleCache = null

/**
 * Generates a custom module linker callback for the Node.js VM context.
 *
 * @param {Object} options - The options used to create the module linker.
 * @param {CoraliteFilePath} options.path - The file path metadata of the component
 * @param {CoralitePluginContext} options.context - Contextual rendering data
 * @param {Object} options.source - Framework source context
 * @param {Object} options.plugins - Bound plugins
 * @returns {(specifier: string, referencingModule: Module, extra: { attributes: any }) => Promise<Module>}
 */
export function createModuleLinker ({ path, context, source, plugins }) {
  const componentDirURL = pathToFileURL(resolve(path.dirname)).href

  return async (specifier, referencingModule, extra) => {
    if (!SourceTextModuleCache) {
      SourceTextModuleCache = (await import('node:vm')).SourceTextModule
    }

    const SourceTextModule = SourceTextModuleCache
    const originalSpecifier = specifier

    if (plugins[specifier]) {
      const plugin = plugins[specifier]
      let pluginExports = ''

      for (const key in plugin) {
        if (Object.prototype.hasOwnProperty.call(plugin, key)) {
          pluginExports += `export const ${key} = globalThis.__coralite_plugins__["${specifier}"]["${key}"];\n`
        }
      }

      return new SourceTextModule(pluginExports, {
        context: referencingModule.context
      })
    } else if (specifier == 'coralite/utils') {
      const utils = source.utils
      let utilsExports = ''

      utilsExports = 'const utils = globalThis.__coralite_utils__; export default utils;'

      for (const key in utils) {
        if (Object.prototype.hasOwnProperty.call(utils, key)) {
          utilsExports += `export const ${key} = utils["${key}"];\n`
        }
      }

      return new SourceTextModule(utilsExports, {
        context: referencingModule.context
      })
    } else if (specifier === 'coralite') {
      let coraliteExports = 'const context = globalThis.__coralite_context__; export default context;'

      for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
          coraliteExports += `export const ${key} = context["${key}"];\n`
        }
      }

      coraliteExports += 'export const defineComponent = globalThis.__coralite_define_component__;\n'

      return new SourceTextModule(coraliteExports, {
        context: referencingModule.context
      })
    } else if (specifier.startsWith('.')) {
      // handle relative path
      specifier = pathToFileURL(resolve(path.dirname, specifier)).href
    } else {
      // handle modules
      specifier = import.meta.resolve(specifier, componentDirURL)
    }

    try {
      let module
      if (extra.attributes && Object.keys(extra.attributes).length > 0) {
        module = await import(specifier, { with: extra.attributes })
      } else {
        module = await import(specifier)
      }
      let exportModule = ''

      for (const key in module) {
        if (Object.prototype.hasOwnProperty.call(module, key)) {
          const name = 'globalThis["' + originalSpecifier + '"].'

          if (key === 'default') {
            exportModule += 'export default ' + name + key + ';\n'
          } else {
            exportModule += 'export const ' + key + ' = ' + name + key + ';\n'
          }
        }

        referencingModule.context[originalSpecifier] = module
      }

      return new SourceTextModule(exportModule, {
        context: referencingModule.context
      })
    } catch (error) {
      throw new CoraliteError(error.message, {
        cause: error,
        filePath: specifier
      })
    }
  }
}

/**
 * Parses a Coralite module script and evaluates it using SourceTextModule.
 *
 * @param {Object} options - The options used for module evaluation in development mode.
 * @param {CoraliteModule} options.module - The Coralite module to parse
 * @param {CoraliteModuleDefinitions} options.state - Replacement tokens for the component
 * @param {CoralitePage} options.page - The global page object
 * @param {any} options.root - The Coralite module to parse
 * @param {string} options.contextId - Context Id
 * @param {CoraliteSession} options.session - Render Context
 * @param {boolean} options.noHydration - No hydration flag
 * @param {Object} options.app - The Coralite instance
 * @param {Object} options.source - Framework source context
 * @param {Function} options.bindPlugins - Function to bind plugins
 * @param {Function} options.defineComponent - Function to define component
 * @param {Function} options.createExecutionError - Function to create execution error
 * @param {Function} options.getComponent - Function to get component
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
export async function evaluateDevelopment ({
  module,
  state,
  page,
  root,
  contextId,
  session,
  noHydration,
  app,
  source,
  bindPlugins,
  defineComponent,
  createExecutionError,
  getComponent
}) {
  if (!SourceTextModuleCache) {
    SourceTextModuleCache = (await import('node:vm')).SourceTextModule
  }
  const SourceTextModule = SourceTextModuleCache

  if (!SourceTextModule) {
    throw new CoraliteError('SourceTextModule is not available. Please run Node.js with --experimental-vm-modules to use Development mode.')
  }

  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    session,
    app,
    noHydration
  }

  const cachedBoundPlugins = await bindPlugins(source.plugins, context)

  session.source.currentSourceContextId = contextId
  session.source.contextInstances[contextId] = context

  const boundDefineComponent = (options) => defineComponent(options, context)

  const standardBuiltIns = new Set(['Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Math', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'JSON', 'Promise', 'Proxy', 'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'Symbol', 'Infinity', 'NaN', 'undefined', 'globalThis', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'unescape'])
  if (!module._globalsCache) {
    module._globalsCache = extractGlobals(module.script)
  }
  const usedGlobals = module._globalsCache

  const contextGlobals = {
    __coralite_context__: context,
    __coralite_plugins__: cachedBoundPlugins,
    __coralite_utils__: source.utils,
    __coralite_define_component__: boundDefineComponent
  }

  for (const glob of usedGlobals) {
    if (!standardBuiltIns.has(glob) && glob in globalThis && globalThis[glob] !== undefined && !(glob in contextGlobals)) {
      contextGlobals[glob] = globalThis[glob]
    }
  }

  const contextifiedObject = createContext(contextGlobals)
  const moduleComponent = getComponent(module.id)

  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = pathToFileURL(resolve(moduleComponent.path.pathname)).href
    },
    lineOffset: module.lineOffset || 0,
    identifier: pathToFileURL(resolve(moduleComponent.path.pathname)).href,
    context: contextifiedObject
  })

  const linker = createModuleLinker({
    path: moduleComponent.path,
    context,
    source,
    plugins: cachedBoundPlugins
  })

  await script.link(linker)

  try {
    await script.evaluate()
  } catch (error) {
    throw createExecutionError(error, module, moduleComponent, page, contextId)
  }

  // @ts-ignore
  if (script.namespace.default != null) {
    // @ts-ignore
    return await script.namespace.default
  }

  throw new CoraliteError(`Module "${module.id}" has no default export`, {
    componentId: module.id,
    filePath: moduleComponent.path.pathname
  })
}

/**
 * Parses a Coralite module script and compiles it into JavaScript using esbuild.
 *
 * @param {Object} options - The options used for module evaluation.
 * @param {CoraliteModule} options.module - The Coralite module to parse
 * @param {CoraliteModuleDefinitions} options.state - Replacement tokens for the component
 * @param {CoralitePage} options.page - The global page object
 * @param {any} options.root - The Coralite module to parse
 * @param {string} options.contextId - Context Id
 * @param {CoraliteSession} options.session - Render Context
 * @param {boolean} options.noHydration - No hydration flag
 * @param {Object} options.app - The Coralite instance
 * @param {Object} options.source - Framework source context
 * @param {Function} options.bindPlugins - Function to bind plugins
 * @param {Function} options.defineComponent - Function to define component
 * @param {Function} options.createExecutionError - Function to create execution error
 * @param {Function} options.getComponent - Function to get component
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
export async function evaluateProduction ({
  module,
  state,
  page,
  root,
  contextId,
  session,
  noHydration,
  app,
  source,
  bindPlugins,
  defineComponent,
  createExecutionError,
  getComponent
}) {
  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    session,
    app,
    noHydration
  }

  session.source.currentSourceContextId = contextId
  session.source.contextInstances[contextId] = context

  const moduleComponent = getComponent(module.id)

  if (!moduleComponent.result._compiledCode) {
    const paddingCount = Math.max(0, (module.lineOffset - 1 || 0))
    const padding = '\n'.repeat(paddingCount)

    const { code } = await transform(padding + module.script, {
      loader: 'js',
      format: 'cjs',
      target: 'node18',
      platform: 'node'
    })

    moduleComponent.result._compiledCode = `(async() => {${code}})();`
  }

  const fileRequire = createRequire(resolve(moduleComponent.path.pathname))
  const cachedBoundPlugins = await bindPlugins(source.plugins, context)

  const customRequire = (id) => {
    const isCoralite = id === 'coralite'
    const isUtils = id === 'coralite/utils'
    const isPlugin = source.plugins[id] !== undefined

    if (isCoralite || isUtils || isPlugin) {
      if (isCoralite) {
        return {
          ...context,
          defineComponent: (options) => defineComponent(options, context),
          default: {
            ...context,
            defineComponent: (options) => defineComponent(options, context)
          }
        }
      }

      if (isPlugin) {
        return {
          ...(cachedBoundPlugins[id] || {}),
          default: cachedBoundPlugins[id]
        }
      }

      if (isUtils) {
        return {
          ...source.utils,
          default: source.utils
        }
      }
    }

    return fileRequire(id)
  }

  const moduleMock = { exports: {} }

  if (!moduleComponent.result._compiledFunction) {
    moduleComponent.result._compiledFunction = new Function(
      'module',
      'exports',
      'require',
      'coralite',
      moduleComponent.result._compiledCode.trim()
    )
  }

  const fn = moduleComponent.result._compiledFunction

  try {
    await fn(moduleMock, moduleMock.exports, customRequire, context)
  } catch (error) {
    throw createExecutionError(error, module, moduleComponent, page, contextId)
  }

  if (moduleMock.exports.default != null) {
    return moduleMock.exports.default
  }

  throw new CoraliteError(`Module "${module.id}" has no default export`, {
    componentId: module.id,
    filePath: moduleComponent.path.pathname
  })
}

/**
 * Evaluates a Coralite module script using the appropriate engine for the current mode.
 * @param {any} options - The evaluation options for the module.
 */
export async function evaluate (options) {
  if (options.mode === 'development') {
    return evaluateDevelopment(options)
  }
  return evaluateProduction(options)
}
