import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { parseModule } from './server/utils/parse.js'
import { extractPageScript } from './server/parser/html.js'
import { parsePagePattern } from './server/page/pattern.js'
import { evaluate } from './server/compiler.js'
import { CoraliteError } from './shared/errors.js'

/**
 * Loads a component .html file and returns callable wrappers for server() and client().
 *
 * @param {string} filePath - Path to component .html file (absolute or relative to process.cwd())
 * @param {Object} [options] - Options for component loading
 * @param {Function} [options.transform] - Pre-process source before evaluation
 * @param {Record<string, unknown>} [options.context] - Extra context keys merged into every call
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
  if (!filePath || typeof filePath !== 'string') {
    throw new CoraliteError('Path parameter is required for loadComponent')
  }

  const absolutePath = resolve(process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new CoraliteError(`Component file not found: "${absolutePath}"`, {
      filePath: absolutePath
    })
  }

  let source
  try {
    source = readFileSync(absolutePath, 'utf8')
  } catch (err) {
    throw new CoraliteError(`Failed to read file "${absolutePath}": ${err.message}`, {
      cause: err,
      filePath: absolutePath
    })
  }

  if (typeof options.transform === 'function') {
    source = options.transform(source)
  }

  const errors = []
  const parsedModule = parseModule(source, {
    ignoreByAttribute: [],
    skipRenderByAttribute: []
  })

  const componentId = parsedModule.id || ''

  if (!parsedModule.isTemplate || !parsedModule.script) {
    errors.push(`Component in "${absolutePath}" missing <script> block`)
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

  const module = {
    id: componentId || absolutePath,
    script: parsedModule.script,
    path: {
      pathname: absolutePath,
      dirname: dirname(absolutePath),
      filename: basename(absolutePath)
    },
    lineOffset: parsedModule.lineOffset || 0
  }

  let evaluated = null
  try {
    evaluated = await evaluate({
      module,
      mode: 'development',
      source: { utils: {} }
    })
  } catch (err) {
    const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
      cause: err,
      filePath: absolutePath
    })
    coraliteErr.filePath = coraliteErr.filePath || absolutePath
    throw coraliteErr
  }

  if (!evaluated || typeof evaluated !== 'object') {
    throw new CoraliteError(`Component in "${absolutePath}" did not export a valid definition`, {
      filePath: absolutePath
    })
  }

  const attributes = evaluated.attributes || {}
  const getters = evaluated.getters || {}

  const serverWrapper = async (ctx = {}) => {
    if (typeof evaluated.server !== 'function') {
      return {}
    }
    const defaultRoute = {
      path: '/',
      pattern: '/',
      params: {},
      dynamic: false
    }
    const mergedCtx = {
      route: defaultRoute,
      state: {},
      isServer: true,
      isClient: false,
      app: {},
      ...options.context,
      ...ctx
    }
    try {
      const res = await evaluated.server(mergedCtx)
      return res || {}
    } catch (err) {
      const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        cause: err,
        filePath: absolutePath
      })
      coraliteErr.filePath = coraliteErr.filePath || absolutePath
      throw coraliteErr
    }
  }

  const clientWrapper = async (ctx = {}) => {
    if (typeof evaluated.client !== 'function') {
      return
    }
    const defaultRoute = {
      path: '/',
      pattern: '/',
      params: {},
      dynamic: false
    }
    const mergedCtx = {
      state: {},
      refs: () => null,
      signal: new AbortController().signal,
      route: defaultRoute,
      isServer: false,
      isClient: true,
      emit: () => false,
      observe: () => () => {
      },
      slots: {},
      root: null,
      ...options.context,
      ...ctx
    }
    try {
      await evaluated.client(mergedCtx)
    } catch (err) {
      const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        cause: err,
        filePath: absolutePath
      })
      coraliteErr.filePath = coraliteErr.filePath || absolutePath
      throw coraliteErr
    }
  }

  return {
    server: serverWrapper,
    client: clientWrapper,
    source,
    componentId,
    attributes,
    getters,
    errors
  }
}

/**
 * Loads a page .html file and returns callable wrappers for paths() and server().
 *
 * @param {string} filePath - Path to page .html file (absolute or relative to process.cwd())
 * @param {Object} [options] - Options for page loading
 * @param {Function} [options.transform] - Pre-process source before evaluation
 * @param {Record<string, unknown>} [options.context] - Extra context keys merged into every call
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
  if (!filePath || typeof filePath !== 'string') {
    throw new CoraliteError('Path parameter is required for loadPage')
  }

  const absolutePath = resolve(process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new CoraliteError(`Page file not found: "${absolutePath}"`, {
      filePath: absolutePath
    })
  }

  let source
  try {
    source = readFileSync(absolutePath, 'utf8')
  } catch (err) {
    throw new CoraliteError(`Failed to read file "${absolutePath}": ${err.message}`, {
      cause: err,
      filePath: absolutePath
    })
  }

  if (typeof options.transform === 'function') {
    source = options.transform(source)
  }

  let routePattern = null
  let routeParams = []
  try {
    const normPath = absolutePath.replace(/\\/g, '/')
    let pagesRoot = ''
    if (normPath.includes('/pages/')) {
      pagesRoot = normPath.slice(0, normPath.indexOf('/pages/') + 6)
    } else if (filePath.startsWith('pages/')) {
      pagesRoot = 'pages'
    } else {
      pagesRoot = dirname(absolutePath)
    }
    const parsedPattern = parsePagePattern(absolutePath, pagesRoot)
    routePattern = parsedPattern.pattern
    routeParams = parsedPattern.params
  } catch {
    // Gracefully handle route pattern resolution failures
  }

  const errors = []
  let parsedScript = null
  try {
    parsedScript = extractPageScript(source, { filePath: absolutePath })
  } catch (err) {
    const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
      cause: err,
      filePath: absolutePath
    })
    coraliteErr.filePath = coraliteErr.filePath || absolutePath
    throw coraliteErr
  }

  if (!parsedScript || !parsedScript.script) {
    errors.push(`Page in "${absolutePath}" missing <script> block`)
    return {
      paths: async () => [],
      server: async () => ({}),
      source,
      routePattern,
      routeParams,
      errors
    }
  }

  const module = {
    id: absolutePath,
    script: parsedScript.script,
    path: {
      pathname: absolutePath,
      dirname: dirname(absolutePath),
      filename: basename(absolutePath)
    }
  }

  const pageObj = {
    url: { pathname: absolutePath },
    file: { pathname: absolutePath },
    routePattern,
    routeParams,
    blocks: parsedScript.blocks,
    hasDefinePage: parsedScript.hasDefinePage
  }

  let pageExports = null
  try {
    pageExports = await evaluate({
      module,
      page: pageObj,
      mode: 'development',
      source: { utils: {} }
    })
  } catch (err) {
    const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
      cause: err,
      filePath: absolutePath
    })
    coraliteErr.filePath = coraliteErr.filePath || absolutePath
    throw coraliteErr
  }

  const pathsWrapper = async (ctx = {}) => {
    if (!pageExports || typeof pageExports.paths !== 'function') {
      return []
    }
    const mergedCtx = {
      app: {},
      ...options.context,
      ...ctx
    }
    try {
      const res = await pageExports.paths(mergedCtx)
      return res || []
    } catch (err) {
      const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        cause: err,
        filePath: absolutePath
      })
      coraliteErr.filePath = coraliteErr.filePath || absolutePath
      throw coraliteErr
    }
  }

  const serverWrapper = async (ctx = {}) => {
    if (!pageExports || typeof pageExports.server !== 'function') {
      return {}
    }
    const defaultRoute = {
      path: routePattern || '/',
      pattern: routePattern || '/',
      params: {},
      dynamic: Boolean(routeParams.length)
    }
    const mergedCtx = {
      route: defaultRoute,
      state: {},
      isServer: true,
      isClient: false,
      app: {},
      ...options.context,
      ...ctx
    }
    try {
      const res = await pageExports.server(mergedCtx)
      return res || {}
    } catch (err) {
      const coraliteErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        cause: err,
        filePath: absolutePath
      })
      coraliteErr.filePath = coraliteErr.filePath || absolutePath
      throw coraliteErr
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
