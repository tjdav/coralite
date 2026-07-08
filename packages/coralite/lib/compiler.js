import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createContext } from 'node:vm'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { extractGlobals } from './utils/server/server.js'
import { CoraliteError } from './utils/errors.js'

/**
 * @import { CoraliteModule, CoraliteModuleDefinitions, CoralitePage, CoraliteSession, CoraliteFilePath, CoralitePluginContext } from '../types/index.js'
 * @import { Module } from 'node:vm'
 */

let SourceTextModuleCache = null

const isValidIdentifier = (name) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)

/**
 * Generates a custom module linker callback for the Node.js VM context.
 *
 * @param {Object} options - The options used to create the module linker.
 * @param {CoraliteFilePath} options.path - The file path metadata of the component
 * @param {CoralitePluginContext} options.context - Contextual rendering data
 * @param {Object} options.source - Framework source context
 * @param {Function} options.importModuleDynamically - The dynamic import callback
 * @returns {(specifier: string, referencingModule: Module, extra: { attributes: any }) => Promise<Module>}
 */
export function createModuleLinker ({ path, context, source, importModuleDynamically }) {
  const componentFileURL = pathToFileURL(resolve(path.pathname)).href

  return async (specifier, referencingModule, extra) => {
    if (!SourceTextModuleCache) {
      SourceTextModuleCache = (await import('node:vm')).SourceTextModule
    }

    const SourceTextModule = SourceTextModuleCache
    const originalSpecifier = specifier

    if (specifier == 'coralite/utils') {
      const utils = source.utils
      let utilsExports = ''

      utilsExports = 'const utils = globalThis.__coralite_utils__; export default utils;'

      for (const key in utils) {
        if (Object.prototype.hasOwnProperty.call(utils, key) && isValidIdentifier(key)) {
          utilsExports += `export const ${key} = utils["${key}"];\n`
        }
      }

      return new SourceTextModule(utilsExports, {
        context: referencingModule.context,
        importModuleDynamically
      })
    } else if (specifier === 'coralite') {
      let coraliteExports = 'const context = globalThis.__coralite_context__; export default context;'

      for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key) && isValidIdentifier(key)) {
          coraliteExports += `export const ${key} = context["${key}"];\n`
        }
      }

      coraliteExports += 'export const defineComponent = globalThis.__coralite_define_component__;\n'
      coraliteExports += 'export const createCoraliteElement = globalThis.__coralite_create_coralite_element__;\n'
      coraliteExports += 'export const processHTML = globalThis.__coralite_process_html__;\n'

      return new SourceTextModule(coraliteExports, {
        context: referencingModule.context,
        importModuleDynamically
      })
    } else if (specifier.startsWith('.')) {
      // handle relative path
      specifier = pathToFileURL(resolve(path.dirname, specifier)).href
    } else {
      // handle modules
      specifier = import.meta.resolve(specifier, componentFileURL)
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
        context: referencingModule.context,
        importModuleDynamically
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
 * @param {string} options.mode - The build mode
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
  getComponent,
  mode
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
    noHydration,
    mode
  }

  const cachedBoundPlugins = await bindPlugins(source.plugins, context)

  session.source.currentSourceContextId = contextId
  session.source.contextInstances[contextId] = context

  const boundDefineComponent = (options) => defineComponent(options, symmetricalContext)

  const standardBuiltIns = new Set(['Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Math', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'JSON', 'Promise', 'Proxy', 'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'Symbol', 'Infinity', 'NaN', 'undefined', 'globalThis', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'unescape'])
  if (!module._globalsCache) {
    module._globalsCache = extractGlobals(module.script)
  }
  const usedGlobals = module._globalsCache

  const symmetricalContext = {
    ...context,
    ...cachedBoundPlugins
  }

  const contextGlobals = {
    __coralite_context__: symmetricalContext,
    __coralite_plugins__: cachedBoundPlugins,
    __coralite_utils__: source.utils,
    __coralite_define_component__: boundDefineComponent,
    __coralite_create_coralite_element__: (tag, options) => {
      if (typeof globalThis.createCoraliteElement === 'function') {
        return globalThis.createCoraliteElement(tag, options)
      }
      return globalThis.document.createElement(tag, options)
    },
    __coralite_process_html__: (html) => {
      if (typeof globalThis.processHTML === 'function') {
        return globalThis.processHTML(html)
      }
      return html
    }
  }

  for (const glob of usedGlobals) {
    if (!standardBuiltIns.has(glob) && glob in globalThis && globalThis[glob] !== undefined && !(glob in contextGlobals)) {
      contextGlobals[glob] = globalThis[glob]
    }
  }

  const contextifiedObject = createContext(contextGlobals)
  const moduleComponent = getComponent(module.id)

  let linker

  const importModuleDynamically = async (specifier, referencingModule, extra) => {
    const mod = await linker(specifier, referencingModule, extra)
    if (mod.status === 'unlinked') {
      await mod.link(linker)
    }
    if (mod.status === 'linked') {
      await mod.evaluate()
    }
    return mod
  }

  linker = createModuleLinker({
    path: moduleComponent.path,
    context: symmetricalContext,
    source,
    importModuleDynamically
  })

  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = pathToFileURL(resolve(moduleComponent.path.pathname)).href
    },
    importModuleDynamically,
    lineOffset: module.lineOffset || 0,
    identifier: pathToFileURL(resolve(moduleComponent.path.pathname)).href,
    context: contextifiedObject
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
 * @param {string} options.mode - The build mode
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
  getComponent,
  mode
}) {
  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    session,
    app,
    noHydration,
    mode
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

    moduleComponent.result._compiledCode = `return (async() => {${code}})();`
  }

  const fileRequire = createRequire(resolve(moduleComponent.path.pathname))
  const cachedBoundPlugins = await bindPlugins(source.plugins, context)

  const symmetricalContext = {
    ...context,
    ...cachedBoundPlugins
  }

  const customRequire = (id) => {
    const isCoralite = id === 'coralite'
    const isUtils = id === 'coralite/utils'

    if (isCoralite || isUtils) {
      if (isCoralite) {
        const createCoraliteElement = (tag, options) => {
          if (typeof globalThis.createCoraliteElement === 'function') {
            return globalThis.createCoraliteElement(tag, options)
          }
          return globalThis.document.createElement(tag, options)
        }
        const processHTML = (html) => {
          if (typeof globalThis.processHTML === 'function') {
            return globalThis.processHTML(html)
          }
          return html
        }
        return {
          ...symmetricalContext,
          defineComponent: (options) => defineComponent(options, symmetricalContext),
          createCoraliteElement,
          processHTML,
          default: {
            ...symmetricalContext,
            defineComponent: (options) => defineComponent(options, symmetricalContext),
            createCoraliteElement,
            processHTML
          }
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
