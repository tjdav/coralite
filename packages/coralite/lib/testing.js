import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { parseModule } from './utils/server/parse.js'
import { evaluate } from './compiler.js'
import { CoraliteError } from './utils/errors.js'

/**
 * Normalizes values returned from VM context into standard host objects/arrays.
 *
 * @param {any} val - Value to normalize
 * @returns {any} Normalized host value
 */
function toHostValue (val) {
  if (val === null || val === undefined) {
    return val
  }
  try {
    return JSON.parse(JSON.stringify(val))
  } catch {
    return val
  }
}

/**
 * Parses route pattern and parameter names from a page file path.
 *
 * @param {string} filepath - The relative or absolute file path to a page.
 * @returns {{ routePattern: string, routeParams: string[] }} Parsed pattern and params.
 */
function parsePageRouteInfo (filepath) {
  const norm = filepath.replace(/\\/g, '/')
  let relativePath = norm
  const pagesIdx = norm.indexOf('/pages/')
  if (pagesIdx !== -1) {
    relativePath = norm.slice(pagesIdx + 7)
  } else if (norm.startsWith('pages/')) {
    relativePath = norm.slice(6)
  }

  if (relativePath.endsWith('.html')) {
    relativePath = relativePath.slice(0, -5)
  }

  const rawSegments = relativePath.split('/').filter(Boolean)
  const routeParams = []
  const patternSegments = []

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i]
    if (seg === 'index' && i === rawSegments.length - 1) {
      continue
    }

    const catchAllMatch = seg.match(/^\[\.\.\.([a-zA-Z0-9_$]+)\]$/)
    const paramMatch = seg.match(/^\[([a-zA-Z0-9_$]+)\]$/)

    if (catchAllMatch) {
      const paramName = catchAllMatch[1]
      routeParams.push(paramName)
      patternSegments.push(`:${paramName}*`)
    } else if (paramMatch) {
      const paramName = paramMatch[1]
      routeParams.push(paramName)
      patternSegments.push(`:${paramName}`)
    } else {
      patternSegments.push(seg)
    }
  }

  const routePattern = '/' + patternSegments.join('/')
  return {
    routePattern: routePattern === '' ? '/' : routePattern,
    routeParams
  }
}

/**
 * Loads a Coralite component file and evaluates its script block in the VM context.
 *
 * @param {string} filePath - Path to component HTML file (relative to process.cwd() or absolute)
 * @param {Object} [options] - Configuration options
 * @param {Function} [options.transform] - Pre-processing transform function for raw source
 * @param {Record<string, unknown>} [options.context] - Default context values merged into calls
 * @param {string} [options.mode='development'] - Build mode for evaluation
 * @returns {Promise<{
 *   server: (ctx?: Record<string, unknown>) => Promise<Record<string, unknown>>,
 *   client: (ctx?: Record<string, unknown>) => Promise<void>,
 *   source: string,
 *   componentId: string,
 *   attributes: object,
 *   getters: object,
 *   errors: string[]
 * }>}
 */
export async function loadComponent (filePath, options = {}) {
  const absolutePath = resolve(process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new CoraliteError(`Component file not found: ${filePath}`, {
      filePath: absolutePath
    })
  }

  let rawSource
  try {
    rawSource = await readFile(absolutePath, 'utf8')
  } catch (err) {
    throw new CoraliteError(`Failed to read component file: ${filePath}`, {
      filePath: absolutePath,
      cause: err
    })
  }

  let source = rawSource
  if (typeof options.transform === 'function') {
    source = options.transform(rawSource)
  }

  const errors = []
  let moduleInfo
  try {
    moduleInfo = parseModule(source, {
      ignoreByAttribute: [],
      skipRenderByAttribute: [],
      onError: (err) => {
        if (err && err.message) {
          errors.push(err.message)
        }
      }
    })
  } catch (err) {
    errors.push(err.message || String(err))
  }

  const componentId = moduleInfo?.id || basename(filePath, '.html')

  if (!moduleInfo || !moduleInfo.isTemplate || !moduleInfo.script) {
    if (!moduleInfo?.script) {
      errors.push(`Component "${componentId}" does not contain a <script> block`)
    }

    return {
      server: async () => ({}),
      client: async () => {
      },
      source,
      componentId,
      attributes: {},
      getters: {},
      errors
    }
  }

  let scriptResult = null
  const dummyApp = {
    options: { mode: options.mode || 'development' },
    onError: (err) => {
      if (err && err.message) {
        errors.push(err.message)
      }
    }
  }

  const dummySource = {
    utils: {},
    plugins: {}
  }

  try {
    scriptResult = await evaluate({
      module: {
        id: componentId,
        script: moduleInfo.script,
        lineOffset: moduleInfo.lineOffset || 0,
        path: {
          pathname: absolutePath,
          dirname: dirname(absolutePath)
        }
      },
      state: {},
      page: {
        url: { pathname: absolutePath },
        file: { pathname: absolutePath },
        meta: {}
      },
      root: null,
      contextId: `test-${componentId}`,
      session: {
        generateId: (p) => `${p}-0`,
        state: {},
        source: {
          currentSourceContextId: '',
          contextInstances: {}
        }
      },
      app: dummyApp,
      source: dummySource,
      bindPlugins: async () => ({}),
      defineComponent: (opts) => opts,
      createExecutionError: (err) => err,
      getComponent: () => ({
        id: componentId,
        path: {
          pathname: absolutePath,
          dirname: dirname(absolutePath)
        },
        result: {}
      }),
      mode: options.mode || 'development'
    })
  } catch (err) {
    const errorMsg = err.message || String(err)
    errors.push(errorMsg)
  }

  const definition = (scriptResult && typeof scriptResult === 'object') ? scriptResult : {}
  const rawServer = typeof definition.server === 'function' ? definition.server : null
  const rawClient = typeof definition.client === 'function' ? definition.client : null

  const serverWrapper = async (ctx = {}) => {
    if (!rawServer) {
      return {}
    }
    const mergedCtx = {
      ...(options.context || {}),
      ...ctx
    }
    try {
      const res = await rawServer(mergedCtx)
      return toHostValue(res) || {}
    } catch (err) {
      if (err && typeof err === 'object') {
        try {
          Object.defineProperty(err, 'filePath', {
            value: absolutePath,
            writable: true,
            configurable: true,
            enumerable: true
          })
        } catch {
          err.filePath = absolutePath
        }
      }
      throw err
    }
  }

  const clientWrapper = async (ctx = {}) => {
    if (!rawClient) {
      return
    }
    const mergedCtx = {
      ...(options.context || {}),
      ...ctx
    }
    try {
      await rawClient(mergedCtx)
    } catch (err) {
      if (err && typeof err === 'object') {
        try {
          Object.defineProperty(err, 'filePath', {
            value: absolutePath,
            writable: true,
            configurable: true,
            enumerable: true
          })
        } catch {
          err.filePath = absolutePath
        }
      }
      throw err
    }
  }

  return {
    server: serverWrapper,
    client: clientWrapper,
    source,
    componentId,
    attributes: toHostValue(definition.attributes || {}),
    getters: toHostValue(definition.getters || {}),
    errors
  }
}

/**
 * Loads a Coralite page file and evaluates its script block in the VM context.
 *
 * @param {string} filePath - Path to page HTML file (relative to process.cwd() or absolute)
 * @param {Object} [options] - Configuration options
 * @param {Function} [options.transform] - Pre-processing transform function for raw source
 * @param {Record<string, unknown>} [options.context] - Default context values merged into calls
 * @param {string} [options.mode='development'] - Build mode for evaluation
 * @returns {Promise<{
 *   paths: (ctx?: Record<string, unknown>) => Promise<Array<Record<string, string>>>,
 *   server: (ctx?: Record<string, unknown>) => Promise<Record<string, unknown>>,
 *   source: string,
 *   routePattern: string | null,
 *   routeParams: string[],
 *   errors: string[]
 * }>}
 */
export async function loadPage (filePath, options = {}) {
  const absolutePath = resolve(process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new CoraliteError(`Page file not found: ${filePath}`, {
      filePath: absolutePath
    })
  }

  let rawSource
  try {
    rawSource = await readFile(absolutePath, 'utf8')
  } catch (err) {
    throw new CoraliteError(`Failed to read page file: ${filePath}`, {
      filePath: absolutePath,
      cause: err
    })
  }

  let source = rawSource
  if (typeof options.transform === 'function') {
    source = options.transform(rawSource)
  }

  const errors = []

  const scriptMatch = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)
  const scriptContent = scriptMatch ? scriptMatch[1] : null

  const pageId = basename(filePath, '.html')
  const { routePattern, routeParams } = parsePageRouteInfo(filePath)

  if (!scriptContent) {
    errors.push(`Page "${pageId}" does not contain a <script> block`)
    return {
      paths: async () => [],
      server: async () => ({}),
      source,
      routePattern,
      routeParams,
      errors
    }
  }

  const scriptIndex = source.indexOf('<script')
  const scriptTagEnd = source.indexOf('>', scriptIndex) + 1
  const lineOffset = source.substring(0, scriptTagEnd).split(/\r\n|\r|\n/).length - 1

  let scriptResult = null
  const dummyApp = {
    options: { mode: options.mode || 'development' },
    onError: (err) => {
      if (err && err.message) {
        errors.push(err.message)
      }
    }
  }

  const dummySource = {
    utils: {},
    plugins: {}
  }

  try {
    scriptResult = await evaluate({
      module: {
        id: pageId,
        script: scriptContent,
        lineOffset,
        path: {
          pathname: absolutePath,
          dirname: dirname(absolutePath)
        }
      },
      state: {},
      page: {
        url: { pathname: absolutePath },
        file: { pathname: absolutePath },
        meta: {}
      },
      root: null,
      contextId: `test-page-${pageId}`,
      session: {
        generateId: (p) => `${p}-0`,
        state: {},
        source: {
          currentSourceContextId: '',
          contextInstances: {}
        }
      },
      app: dummyApp,
      source: dummySource,
      bindPlugins: async () => ({}),
      defineComponent: (opts) => opts,
      createExecutionError: (err) => err,
      getComponent: () => ({
        id: pageId,
        path: {
          pathname: absolutePath,
          dirname: dirname(absolutePath)
        },
        result: {}
      }),
      mode: options.mode || 'development'
    })
  } catch (err) {
    const errorMsg = err.message || String(err)
    errors.push(errorMsg)
  }

  const definition = (scriptResult && typeof scriptResult === 'object') ? scriptResult : {}
  const rawPaths = typeof definition.paths === 'function' ? definition.paths : null
  const rawServer = typeof definition.server === 'function' ? definition.server : null

  const pathsWrapper = async (ctx = {}) => {
    if (!rawPaths) {
      return []
    }
    const mergedCtx = {
      ...(options.context || {}),
      ...ctx
    }
    try {
      const res = await rawPaths(mergedCtx)
      return toHostValue(res) || []
    } catch (err) {
      if (err && typeof err === 'object') {
        try {
          Object.defineProperty(err, 'filePath', {
            value: absolutePath,
            writable: true,
            configurable: true,
            enumerable: true
          })
        } catch {
          err.filePath = absolutePath
        }
      }
      throw err
    }
  }

  const serverWrapper = async (ctx = {}) => {
    if (!rawServer) {
      return {}
    }
    const mergedCtx = {
      ...(options.context || {}),
      ...ctx
    }
    try {
      const res = await rawServer(mergedCtx)
      return toHostValue(res) || {}
    } catch (err) {
      if (err && typeof err === 'object') {
        try {
          Object.defineProperty(err, 'filePath', {
            value: absolutePath,
            writable: true,
            configurable: true,
            enumerable: true
          })
        } catch {
          err.filePath = absolutePath
        }
      }
      throw err
    }
  }

  return {
    paths: pathsWrapper,
    server: serverWrapper,
    source,
    routePattern,
    routeParams,
    errors
  }
}
