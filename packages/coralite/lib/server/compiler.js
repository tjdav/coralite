import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { createContext } from 'node:vm'
import { transform } from 'esbuild'
import { createRequire, isBuiltin } from 'node:module'
import { extractGlobals, rewriteDynamicImports } from './utils/server.js'
import * as serverUtilsBase from './utils/index.js'
import { CoraliteError } from '../shared/errors.js'
import { createContext as createContextUtil, ContextRequestEvent } from '../shared/core.js'
import { definePage, PAGE_EXPORTS } from '../shared/page.js'
import { createStore, createServerStore } from '../utils/store.js'

/**
 * @import { CoraliteModule, CoraliteModuleDefinitions, CoralitePage, CoraliteSession, CoraliteFilePath, CoralitePluginContext } from '../../types/index.js'
 * @import { Module } from 'node:vm'
 */

let SourceTextModuleCache = null

export const RECOGNIZED_COMPONENT_EXPORTS = [
  'server',
  'client',
  'onError',
  'getters',
  'attributes',
  'style',
  'slots',
  'provide',
  'consume',
  'formControl',
  'listStrategy'
]

export const RECOGNIZED_PAGE_EXPORTS = PAGE_EXPORTS

const isValidIdentifier = (name) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)

const RESERVED_WORDS = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield'
])

const isExportableName = (name) => isValidIdentifier(name) && name !== 'default' && !RESERVED_WORDS.has(name)

/**
 * Creates a specifier resolver anchored to a component or page file.
 *
 * Relative specifiers resolve through Node's CommonJS resolver first, which
 * provides extensionless and directory-index fallbacks. Non-module assets fall
 * back to a file URL anchored at the source file. Bare packages prefer the
 * CommonJS resolver so resolution stays correct even when the process was not
 * started with `--experimental-import-meta-resolve`.
 *
 * @param {Object} options - The resolver options.
 * @param {CoraliteFilePath} options.path - The source file path metadata.
 * @param {{ (id: string): any, resolve: (specifier: string) => string }} [options.fileRequire] - A require function anchored to the source file.
 * @returns {(specifier: string) => string} A resolver returning a URL or builtin specifier.
 */
export function createDynamicResolver ({ path, fileRequire }) {
  const componentPath = resolve(path.pathname)
  const componentFileURL = pathToFileURL(componentPath).href
  const componentDir = dirname(componentPath)
  const requireFromComponent = fileRequire || createRequire(componentPath)

  return function resolveDynamicSpecifier (specifier) {
    if (isBuiltin(specifier)) {
      return specifier
    }

    if (/^(file|data|https?):/.test(specifier)) {
      return specifier
    }

    try {
      return pathToFileURL(requireFromComponent.resolve(specifier)).href
    } catch {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        return pathToFileURL(resolve(componentDir, specifier)).href
      }

      try {
        return import.meta.resolve(specifier, componentFileURL)
      } catch (error) {
        throw new CoraliteError(`Failed to resolve "${specifier}" from "${path.pathname}"`, {
          cause: error,
          filePath: path.pathname
        })
      }
    }
  }
}

/**
 * Creates a dynamic importer anchored to a component or page file.
 *
 * @param {Object} options - The importer options.
 * @param {Object} options.moduleComponent - The owning module component.
 * @param {(id: string) => any} options.customRequire - The Coralite-aware require shim.
 * @param {{ (id: string): any, resolve: (specifier: string) => string }} options.fileRequire - A require function anchored to the source file.
 * @param {(specifier: string) => string} options.resolve - The anchored specifier resolver.
 * @returns {(specifier: string, options?: any) => Promise<any>} The dynamic importer.
 */
export function createDynamicImporter ({ moduleComponent, customRequire, fileRequire, resolve: resolveSpecifier }) {
  const sourcePath = moduleComponent.path?.pathname

  return async function importDynamicSpecifier (specifier, options) {
    try {
      if (specifier === 'coralite' || specifier === 'coralite/utils' || specifier === 'coralite/utils/server') {
        return customRequire(specifier)
      }

      if (isBuiltin(specifier)) {
        return await import(specifier, options)
      }

      const targetSpecifier = resolveSpecifier(specifier)
      const importType = options?.with?.type || options?.assert?.type

      if (!importType && targetSpecifier.startsWith('file:') && targetSpecifier.endsWith('.json')) {
        const json = fileRequire(fileURLToPath(targetSpecifier))
        return {
          default: json,
          ...json
        }
      }

      return await import(targetSpecifier, options)
    } catch (error) {
      if (error?.isCoraliteError) {
        throw error
      }

      throw new CoraliteError(`Failed to import "${specifier}" from "${sourcePath || moduleComponent.id}": ${error.message}`, {
        cause: error,
        filePath: sourcePath,
        componentId: moduleComponent.id
      })
    }
  }
}

/**
 * Generates a custom module linker callback for the Node.js VM context.
 *
 * @param {Object} options - The options used to create the module linker.
 * @param {CoraliteFilePath} options.path - The file path metadata of the component
 * @param {CoralitePluginContext} options.context - Contextual rendering data
 * @param {Object} options.source - Framework source context
 * @param {Function} options.importModuleDynamically - The dynamic import callback
 * @param {{ (id: string): any, resolve: (specifier: string) => string }} [options.fileRequire] - A require function anchored to the component file
 * @param {(specifier: string) => string} [options.resolve] - An anchored specifier resolver
 * @returns {(specifier: string, referencingModule: Module, extra: { attributes: any }) => Promise<Module>}
 */
export function createModuleLinker ({ path, context, source, importModuleDynamically, fileRequire, resolve: resolveSpecifier }) {
  const componentPath = resolve(path.pathname)
  const requireFromComponent = fileRequire || createRequire(componentPath)
  const resolveDynamicSpecifier = resolveSpecifier || createDynamicResolver({
    path,
    fileRequire: requireFromComponent
  })
  return async (specifier, referencingModule, extra) => {
    if (!SourceTextModuleCache) {
      SourceTextModuleCache = (await import('node:vm')).SourceTextModule
    }

    const SourceTextModule = SourceTextModuleCache
    const originalSpecifier = specifier

    if (specifier === 'coralite/utils') {
      const utils = source.utils
      let utilsExports = ''

      utilsExports = 'const utils = globalThis.__coralite__.utils; export default utils;'

      for (const key in utils) {
        if (Object.prototype.hasOwnProperty.call(utils, key) && isExportableName(key)) {
          utilsExports += `export const ${key} = utils["${key}"];\n`
        }
      }

      return new SourceTextModule(utilsExports, {
        context: referencingModule.context,
        importModuleDynamically
      })
    } else if (specifier === 'coralite/utils/server') {
      const serverUtils = {
        ...serverUtilsBase,
        ...(source?.utils || {})
      }
      let serverExports = 'const serverUtils = globalThis.__coralite__.serverUtils; export default serverUtils;\n'

      for (const key in serverUtils) {
        if (Object.prototype.hasOwnProperty.call(serverUtils, key) && isExportableName(key)) {
          serverExports += `export const ${key} = serverUtils["${key}"];\n`
        }
      }

      return new SourceTextModule(serverExports, {
        context: referencingModule.context,
        importModuleDynamically
      })
    } else if (specifier === 'coralite') {
      let coraliteExports = 'const context = globalThis.__coralite__.context; export default context;'

      for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key) && isExportableName(key)) {
          coraliteExports += `export const ${key} = context["${key}"];\n`
        }
      }

      coraliteExports += 'export const defineComponent = globalThis.__coralite__.defineComponent;\n'
      coraliteExports += 'export const definePage = globalThis.__coralite__.definePage;\n'
      coraliteExports += 'export const createCoraliteElement = globalThis.__coralite__.createElement;\n'
      coraliteExports += 'export const processHTML = globalThis.__coralite__.processHTML;\n'
      coraliteExports += 'export const createContext = globalThis.__coralite__.createContext;\n'
      coraliteExports += 'export const ContextRequestEvent = globalThis.__coralite__.ContextRequestEvent;\n'

      return new SourceTextModule(coraliteExports, {
        context: referencingModule.context,
        importModuleDynamically
      })
    }

    const targetSpecifier = resolveDynamicSpecifier(specifier)
    const attributes = extra?.attributes || extra
    const hasAttributes = attributes && Object.keys(attributes).length > 0

    try {
      let importedModule

      if (!hasAttributes && targetSpecifier.startsWith('file:') && targetSpecifier.endsWith('.json')) {
        const json = requireFromComponent(fileURLToPath(targetSpecifier))
        importedModule = {
          default: json,
          ...json
        }
      } else if (hasAttributes) {
        importedModule = await import(targetSpecifier, { with: attributes })
      } else {
        importedModule = await import(targetSpecifier)
      }

      let exportModule = ''
      const namespaceName = 'globalThis.__coralite__.imports[' + JSON.stringify(originalSpecifier) + ']'

      for (const key in importedModule) {
        if (!Object.prototype.hasOwnProperty.call(importedModule, key)) {
          continue
        }

        if (key === 'default') {
          exportModule += 'export default ' + namespaceName + '[' + JSON.stringify(key) + '];\n'
        } else if (isExportableName(key)) {
          exportModule += 'export const ' + key + ' = ' + namespaceName + '[' + JSON.stringify(key) + '];\n'
        }
      }

      referencingModule.context.__coralite__.imports[originalSpecifier] = importedModule

      return new SourceTextModule(exportModule, {
        context: referencingModule.context,
        importModuleDynamically
      })
    } catch (error) {
      if (error?.isCoraliteError) {
        throw error
      }

      throw new CoraliteError(`Failed to import "${originalSpecifier}" from "${path.pathname}": ${error.message}`, {
        cause: error,
        filePath: path.pathname
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
 * @param {Object} [options.route] - Route object
 * @param {any} options.root - The Coralite module to parse
 * @param {string} options.contextId - Context Id
 * @param {CoraliteSession} options.session - Render Context
 * @param {boolean} options.noHydration - No hydration flag
 * @param {Object} options.app - The Coralite instance
 * @param {Object} options.source - Framework source context
 * @param {Function} options.bindPlugins - Function to bind plugins
 * @param {Function} options.defineComponent - Function to define component
 * @param {boolean} [options.isPage=false] - Whether the module is a page script
 * @param {Function} options.createExecutionError - Function to create execution error
 * @param {Function} options.getComponent - Function to get component
 * @param {Array<Record<string|symbol, any>>} [options.contextFrames] - Threaded context frames
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
export async function evaluateDevelopment ({
  module,
  state,
  page,
  route,
  root,
  contextId,
  session,
  noHydration,
  app,
  source,
  bindPlugins,
  defineComponent,
  isPage = false,
  createExecutionError,
  getComponent,
  contextFrames = []
}) {
  if (!SourceTextModuleCache) {
    SourceTextModuleCache = (await import('node:vm')).SourceTextModule
  }
  const SourceTextModule = SourceTextModuleCache

  if (!SourceTextModule) {
    throw new CoraliteError('SourceTextModule is not available. Please run Node.js with --experimental-vm-modules to use Development mode.')
  }

  const serverStore = app?.options?.store ? createServerStore(app.options.store) : undefined
  const reactiveStore = app?.options?.store ? createStore(app.options.store) : undefined

  const context = {
    state: state || {},
    page,
    route: route || page?.route,
    root,
    module,
    id: contextId,
    session,
    app,
    noHydration,
    contextFrames,
    isServer: true,
    isClient: false,
    store: serverStore,
    serverStore,
    reactiveStore
  }

  const serverUtils = {
    ...serverUtilsBase,
    ...source.utils
  }

  const virtualWindow = serverUtilsBase.createVirtualWindow(context)
  context.window = virtualWindow
  context.document = virtualWindow.document

  const bindPluginsFn = bindPlugins || (async () => ({}))
  const createExecutionErrorFn = createExecutionError || ((err) => err)

  const cachedBoundPlugins = await bindPluginsFn(source?.plugins || {}, context)

  if (session && session.source) {
    session.source.currentSourceContextId = contextId
    session.source.contextInstances[contextId] = context
  }

  const boundDefineComponent = (options) => (defineComponent ? defineComponent(options, symmetricalContext) : options)

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
    __coralite__: {
      context: symmetricalContext,
      utils: source.utils,
      serverUtils,
      imports: {},
      defineComponent: boundDefineComponent,
      definePage,
      createContext: createContextUtil,
      ContextRequestEvent,
      createElement: (tag, options) => {
        if (typeof globalThis.createCoraliteElement === 'function') {
          return globalThis.createCoraliteElement(tag, options)
        }
        return virtualWindow.document.createElement(tag, options)
      },
      processHTML: (html) => {
        if (typeof globalThis.processHTML === 'function') {
          return globalThis.processHTML(html)
        }
        return html
      }
    }
  }

  for (const glob of usedGlobals) {
    if (!standardBuiltIns.has(glob) && glob in globalThis && globalThis[glob] !== undefined && !(glob in contextGlobals)) {
      contextGlobals[glob] = globalThis[glob]
    }
  }

  const contextifiedObject = createContext(contextGlobals)
  contextifiedObject.globalThis = contextifiedObject
  const targetItem = (getComponent && getComponent(module.id)) || null
  const moduleComponent = targetItem || {
    id: module.id,
    result: module,
    path: module.path
  }

  const componentPath = resolve(moduleComponent.path.pathname)
  const componentFileURL = pathToFileURL(componentPath).href
  const fileRequire = createRequire(componentPath)
  const resolveDynamicSpecifier = createDynamicResolver({
    path: moduleComponent.path,
    fileRequire
  })

  // eslint-disable-next-line prefer-const -- circular closure; see importModuleDynamically
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
    importModuleDynamically,
    fileRequire,
    resolve: resolveDynamicSpecifier
  })

  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = componentFileURL
      meta.resolve = resolveDynamicSpecifier
    },
    importModuleDynamically,
    lineOffset: module.lineOffset || 0,
    identifier: componentFileURL,
    context: contextifiedObject
  })

  await script.link(linker)

  try {
    await script.evaluate()
  } catch (error) {
    throw createExecutionErrorFn(error, module, moduleComponent, page, contextId)
  }

  // @ts-ignore
  // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
  if (script.namespace.default != null) {
    // @ts-ignore
    return script.namespace.default
  }

  if (isPage) {
    const pageExports = {}
    let hasPageExport = false
    for (const key of RECOGNIZED_PAGE_EXPORTS) {
      if (key in script.namespace && script.namespace[key] !== undefined) {
        pageExports[key] = script.namespace[key]
        hasPageExport = true
      }
    }
    return hasPageExport ? pageExports : {}
  }

  if (defineComponent) {
    const namedExports = {}
    let hasRecognizedExport = false
    for (const key of RECOGNIZED_COMPONENT_EXPORTS) {
      if (key in script.namespace && script.namespace[key] !== undefined) {
        namedExports[key] = script.namespace[key]
        hasRecognizedExport = true
      }
    }
    if (hasRecognizedExport) {
      return boundDefineComponent(namedExports)
    }
    return boundDefineComponent({})
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
 * @param {Object} [options.route] - Route object
 * @param {any} options.root - The Coralite module to parse
 * @param {string} options.contextId - Context Id
 * @param {CoraliteSession} options.session - Render Context
 * @param {boolean} options.noHydration - No hydration flag
 * @param {Object} options.app - The Coralite instance
 * @param {Object} options.source - Framework source context
 * @param {Function} options.bindPlugins - Function to bind plugins
 * @param {Function} options.defineComponent - Function to define component
 * @param {boolean} [options.isPage=false] - Whether the module is a page script
 * @param {Function} options.createExecutionError - Function to create execution error
 * @param {Function} options.getComponent - Function to get component
 * @param {Array<Record<string|symbol, any>>} [options.contextFrames] - Threaded context frames
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
export async function evaluateProduction ({
  module,
  state,
  page,
  route,
  root,
  contextId,
  session,
  noHydration,
  app,
  source,
  bindPlugins,
  defineComponent,
  isPage = false,
  createExecutionError,
  getComponent,
  contextFrames = []
}) {
  const serverStore = app?.options?.store ? createServerStore(app.options.store) : undefined
  const reactiveStore = app?.options?.store ? createStore(app.options.store) : undefined

  const context = {
    state: state || {},
    page,
    route: route || page?.route,
    root,
    module,
    id: contextId,
    session,
    app,
    noHydration,
    contextFrames,
    isServer: true,
    isClient: false,
    store: serverStore,
    serverStore,
    reactiveStore
  }

  if (session && session.source) {
    session.source.currentSourceContextId = contextId
    session.source.contextInstances[contextId] = context
  }

  const targetItem = (getComponent && getComponent(module.id)) || null
  const moduleComponent = targetItem || {
    id: module.id,
    result: module,
    path: module.path
  }

  const componentPath = resolve(moduleComponent.path.pathname)
  const componentFileURL = pathToFileURL(componentPath).href

  if (!moduleComponent.result._compiledCode) {
    const paddingCount = Math.max(0, (module.lineOffset - 1 || 0))
    const padding = '\n'.repeat(paddingCount)
    const rewrittenScript = rewriteDynamicImports(module.script)

    const { code } = await transform(padding + rewrittenScript, {
      loader: 'js',
      format: 'cjs',
      target: 'node18',
      platform: 'node',
      define: {
        'import.meta': 'coraliteRuntime.importMeta'
      }
    })

    moduleComponent.result._compiledCode = `return (async() => {${code}})();`
  }

  const fileRequire = createRequire(componentPath)

  const serverUtils = {
    ...serverUtilsBase,
    ...source.utils
  }

  const virtualWindow = serverUtilsBase.createVirtualWindow(context)
  context.window = virtualWindow
  context.document = virtualWindow.document

  const bindPluginsFn = bindPlugins || (async () => ({}))
  const createExecutionErrorFn = createExecutionError || ((err) => err)

  const cachedBoundPlugins = await bindPluginsFn(source?.plugins || {}, context)

  const symmetricalContext = {
    ...context,
    ...cachedBoundPlugins
  }

  const customRequire = (id) => {
    const isCoralite = id === 'coralite'
    const isUtils = id === 'coralite/utils'
    const isServerUtils = id === 'coralite/utils/server'

    if (isCoralite || isUtils || isServerUtils) {
      if (isCoralite) {
        const createCoraliteElement = (tag, options) => {
          if (typeof globalThis.createCoraliteElement === 'function') {
            return globalThis.createCoraliteElement(tag, options)
          }
          return virtualWindow.document.createElement(tag, options)
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
          definePage,
          createCoraliteElement,
          processHTML,
          createContext: createContextUtil,
          ContextRequestEvent,
          default: {
            ...symmetricalContext,
            defineComponent: (options) => defineComponent(options, symmetricalContext),
            definePage,
            createCoraliteElement,
            processHTML,
            createContext: createContextUtil,
            ContextRequestEvent
          }
        }
      }

      if (isUtils) {
        return {
          ...source.utils,
          default: source.utils
        }
      }

      if (isServerUtils) {
        return {
          ...serverUtils,
          default: serverUtils
        }
      }
    }

    return fileRequire(id)
  }

  const resolveDynamicSpecifier = createDynamicResolver({
    path: moduleComponent.path,
    fileRequire
  })

  const customImport = createDynamicImporter({
    moduleComponent,
    customRequire,
    fileRequire,
    resolve: resolveDynamicSpecifier
  })

  const importMeta = {
    url: componentFileURL,
    resolve: resolveDynamicSpecifier
  }

  const coraliteRuntime = {
    import: customImport,
    importMeta
  }

  const moduleMock = { exports: {} }

  if (!moduleComponent.result._compiledFunction) {
    moduleComponent.result._compiledFunction = new Function(
      'module',
      'exports',
      'require',
      'coralite',
      'coraliteRuntime',
      moduleComponent.result._compiledCode.trim()
    )
  }

  const fn = moduleComponent.result._compiledFunction

  try {
    await fn(moduleMock, moduleMock.exports, customRequire, symmetricalContext, coraliteRuntime)
  } catch (error) {
    throw createExecutionErrorFn(error, module, moduleComponent, page, contextId)
  }

  // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
  if (moduleMock.exports.default != null) {
    return moduleMock.exports.default
  }

  if (isPage) {
    const pageExports = {}
    let hasPageExport = false
    for (const key of RECOGNIZED_PAGE_EXPORTS) {
      if (key in moduleMock.exports && moduleMock.exports[key] !== undefined) {
        pageExports[key] = moduleMock.exports[key]
        hasPageExport = true
      }
    }
    return hasPageExport ? pageExports : {}
  }

  if (defineComponent) {
    const namedExports = {}
    let hasRecognizedExport = false
    for (const key of RECOGNIZED_COMPONENT_EXPORTS) {
      if (key in moduleMock.exports && moduleMock.exports[key] !== undefined) {
        namedExports[key] = moduleMock.exports[key]
        hasRecognizedExport = true
      }
    }
    if (hasRecognizedExport) {
      return defineComponent(namedExports, symmetricalContext)
    }
    return defineComponent({}, symmetricalContext)
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
