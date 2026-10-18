import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseHTML, parseModule } from '../utils/parse.js'
import { extractPageScript } from '../parser/html.js'
import { registerBaseComponent } from '../component/setup.js'
import { prepareAllComponentOps } from '../utils/fragment.js'
import { validateEnumeratedPaths, validatePluginEnumeratedPaths, deduplicateEnumeratedPaths } from '../page/route.js'
import { parsePagePattern } from '../page/pattern.js'
import { CoraliteError } from '../../shared/errors.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteOnError
 * } from '../../../types/index.js'
 */

/**
 * Factory for collection handlers.
 *
 * @param {Object} context - The context containing shared dependencies for the handlers.
 * @param {CoraliteInstance} context.app - The global Coralite app instance.
 * @param {Function} context.triggerHook - The function used to trigger plugin hooks.
 * @param {CoraliteOnError} context.handleError - The callback for handling errors during collection events.
 * @param {Function} [context.evaluate] - The evaluation function for components.
 * @param {any} [context.scriptManager] - The script manager for components.
 * @param {Function} [context.createSession] - The session creation function.
 * @returns {Object}
 */
export function createPageHandlers ({
  app,
  triggerHook,
  handleError,
  evaluate,
  scriptManager,
  createSession
}) {
  const onFileSetLocal = async (data) => {
    // @ts-ignore
    const rootPath = data.type === 'component' ? app.options.path.components : app.options.path.pages
    const relPath = relative(rootPath, data.path.pathname).replace(/\\/g, '/')
    const urlPathname = pathToFileURL(join('/', relPath)).pathname

    let routePattern = ''
    /** @type {string[]} */
    let routeParams = []
    let routeSegments = []
    try {
      const parsedPattern = parsePagePattern(data.path.pathname, rootPath)
      routePattern = parsedPattern.pattern
      routeParams = parsedPattern.params
      routeSegments = parsedPattern.segments
    } catch (err) {
      if (typeof handleError === 'function') {
        handleError({
          level: 'ERR',
          code: err.code,
          message: err.message,
          error: err,
          filePath: data.path.pathname
        })
      }
    }

    let parsedScript = {
      hasDefinePage: false,
      blocks: null,
      script: null
    }
    if (data.content !== undefined) {
      try {
        parsedScript = extractPageScript(data.content, { filePath: data.path.pathname })
      } catch (err) {
        if (typeof handleError === 'function') {
          handleError({
            level: 'ERR',
            code: err.code,
            message: err.message,
            error: err,
            filePath: data.path.pathname
          })
        }
      }
    }

    const page = {
      url: {
        pathname: urlPathname,
        dirname: pathToFileURL(dirname(urlPathname)).pathname
      },
      file: {
        pathname: data.path.pathname,
        dirname: data.path.dirname,
        filename: data.path.filename
      },
      meta: data.state?.page?.meta || {},
      blocks: parsedScript.blocks,
      hasDefinePage: parsedScript.hasDefinePage,
      script: parsedScript.script,
      routePattern,
      routeParams,
      routeSegments,
      is404: relPath === '404.html',
      enumeratedPaths: []
    }

    const contributions = []

    if (parsedScript.script && evaluate) {
      try {
        const module = {
          id: data.path.pathname,
          script: parsedScript.script,
          path: data.path
        }

        const pageExports = await evaluate({
          module,
          page,
          app,
          source: app.source || { utils: {} },
          mode: app.options.mode
        })

        if (pageExports) {
          Object.defineProperty(page, 'exports', {
            value: pageExports,
            enumerable: false,
            writable: true,
            configurable: true
          })
          if (typeof pageExports.paths === 'function') {
            const rawPaths = await pageExports.paths({ app })
            validateEnumeratedPaths(rawPaths, routeParams, data.path.pathname)
            contributions.push({
              source: 'definePage.paths',
              paths: rawPaths
            })
          }
        }
      } catch (err) {
        const pageErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
          code: err.code || 'CORALITE-E402',
          cause: err,
          filePath: data.path.pathname,
          line: err.line,
          column: err.column
        })
        pageErr.filePath = pageErr.filePath || data.path.pathname
        page.failed = true
        page.error = pageErr
        page.enumeratedPaths = []

        try {
          if (typeof app.onError === 'function') {
            app.onError({
              level: 'ERR',
              code: pageErr.code,
              message: `Failed to evaluate paths block for page "${data.path.pathname}": ${pageErr.message}`,
              error: pageErr,
              filePath: data.path.pathname
            })
          } else if (typeof handleError === 'function') {
            handleError({
              level: 'ERR',
              code: pageErr.code,
              message: `Failed to evaluate paths block for page "${data.path.pathname}": ${pageErr.message}`,
              error: pageErr,
              filePath: data.path.pathname
            })
          }
        } catch {
          /* ignore throw to preserve collection loading */
        }
      }
    }

    const state = {
      ...data.state,
      page
    }

    if (data.content === undefined) {
      return ({
        type: 'page',
        value: {
          state,
          page,
          path: data.path
        }
      })
    }

    const elements = parseHTML(data.content, app.options.ignoreByAttribute, app.options.skipRenderByAttribute, handleError)
    const directPageComponents = app._dependencyGraph.directPageComponents

    if (elements && elements.customElements && directPageComponents) {
      const directComponents = elements.customElements.map(el => el.name)

      directPageComponents[data.path.pathname] = directComponents

      app._refreshDependencyGraph()
    }

    const pluginHookResults = await triggerHook('onPageSet', {
      elements,
      state,
      page,
      data,
      app
    }, { returnAllResults: true })

    const mappedContext = pluginHookResults?.mergedData || {
      elements,
      state,
      page,
      data
    }
    if (!page.failed && Array.isArray(pluginHookResults?.rawResults)) {
      for (const item of pluginHookResults.rawResults) {
        const res = item && typeof item === 'object' && 'result' in item ? item.result : item
        const pluginName = item?.pluginName
        if (res && typeof res === 'object' && Object.hasOwn(res, 'paths')) {
          validatePluginEnumeratedPaths(res.paths, routeParams, data.path.pathname)
          contributions.push({
            source: pluginName ? `plugin "${pluginName}"` : 'plugin',
            paths: res.paths
          })
        }
      }
    }

    if (!page.failed) {
      try {
        page.enumeratedPaths = deduplicateEnumeratedPaths(contributions, data.path.pathname)
      } catch (err) {
        const pageErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
          code: err.code || 'CORALITE-E402',
          cause: err,
          filePath: data.path.pathname
        })
        pageErr.filePath = pageErr.filePath || data.path.pathname
        page.failed = true
        page.error = pageErr
        page.enumeratedPaths = []

        try {
          if (typeof app.onError === 'function') {
            app.onError({
              level: 'ERR',
              code: pageErr.code,
              message: `Failed route deduplication for page "${data.path.pathname}": ${pageErr.message}`,
              error: pageErr,
              filePath: data.path.pathname
            })
          } else if (typeof handleError === 'function') {
            handleError({
              level: 'ERR',
              code: pageErr.code,
              message: `Failed route deduplication for page "${data.path.pathname}": ${pageErr.message}`,
              error: pageErr,
              filePath: data.path.pathname
            })
          }
        } catch {
          /* ignore throw to preserve collection loading */
        }
      }
    }

    const isStatic = app.options.mode === 'production' || app.options.mode === 'testing'
    if (isStatic && !data.virtual) {
      delete data.content
    }

    return {
      type: 'page',
      value: {
        state: mappedContext.state,
        page: mappedContext.page,
        path: mappedContext.data.path,
        root: isStatic ? null : mappedContext.elements.root,
        customElements: isStatic ? null : mappedContext.elements.customElements,
        tempElements: isStatic ? null : mappedContext.elements.tempElements,
        skipRenderElements: isStatic ? null : mappedContext.elements.skipRenderElements
      },
      state: mappedContext.state
    }
  }

  const onPageUpdateLocal = async (newValue, oldValue) => {
    if (app.options.mode === 'production' || app.options.mode === 'testing') {
      if (!newValue.result) {
        await onFileSetLocal(newValue)
      }
      return newValue.result
    }

    if (!newValue.result) {
      const res = await onFileSetLocal(newValue)
      newValue.result = res.value
    }

    const mappedContext = await triggerHook('onPageUpdate', {
      elements: newValue.result,
      page: newValue.result.page,
      newValue,
      oldValue,
      app
    })

    newValue.result = mappedContext.elements
    // eslint-disable-next-line no-param-reassign
    newValue = mappedContext.newValue

    const elements = parseHTML(newValue.content, app.options.ignoreByAttribute, app.options.skipRenderByAttribute, handleError)
    const directPageComponents = app._dependencyGraph.directPageComponents

    if (directPageComponents) {
      if (elements && elements.customElements) {
        const directComponents = elements.customElements.map(el => el.name)
        directPageComponents[newValue.path.pathname] = directComponents
      } else {
        delete directPageComponents[newValue.path.pathname]
      }
    }

    app._refreshDependencyGraph()

    return newValue.result
  }

  const onPageDeleteLocal = async (value) => {
    const res = await triggerHook('onPageDelete', {
      data: value,
      app
    })

    const finalData = res?.data || value
    const pathname = finalData?.path?.pathname
    const directPageComponents = app._dependencyGraph.directPageComponents

    if (pathname && directPageComponents) {
      delete directPageComponents[pathname]
    }

    app._refreshDependencyGraph()
  }

  const onComponentSetLocal = async (v) => {
    if (v.content === undefined) {
      v.content = await getHtmlFile(v.path.pathname)
    }

    let component
    try {
      component = parseModule(v.content, {
        ignoreByAttribute: app.options.ignoreByAttribute,
        skipRenderByAttribute: app.options.skipRenderByAttribute,
        onError: handleError,
        filePath: v.path?.pathname
      })
    } catch (err) {
      if (typeof app?.onError === 'function') {
        app.onError({
          level: 'ERR',
          code: err.code,
          message: err.message,
          error: err,
          filePath: v.path?.pathname
        })
      } else if (typeof handleError === 'function') {
        handleError({
          level: 'ERR',
          code: err.code,
          message: err.message,
          error: err,
          filePath: v.path?.pathname
        })
      }
      return null
    }

    if (!component.isTemplate) {
      return
    }

    const res = await triggerHook('onComponentSet', {
      component,
      module: component,
      app
    })

    return {
      type: 'component',
      id: res.component?.id || res.module?.id || component.id,
      value: res.component || res.module || component
    }
  }

  const onComponentUpdateLocal = async (v) => {
    if (v.content === undefined) {
      v.content = await getHtmlFile(v.path.pathname)
    }

    let component
    try {
      component = parseModule(v.content, {
        ignoreByAttribute: app.options.ignoreByAttribute,
        skipRenderByAttribute: app.options.skipRenderByAttribute,
        onError: handleError
      })
    } catch (err) {
      if (typeof app?.onError === 'function') {
        app.onError({
          level: 'ERR',
          code: err.code,
          message: err.message,
          error: err,
          filePath: v.path?.pathname
        })
      } else if (typeof handleError === 'function') {
        handleError({
          level: 'ERR',
          code: err.code,
          message: err.message,
          error: err,
          filePath: v.path?.pathname
        })
      }
      return null
    }

    if (!component.isTemplate) {
      return
    }

    const res = await triggerHook('onComponentUpdate', {
      component,
      module: component,
      app
    })

    await registerBaseComponent({
      component: res.component,
      evaluate,
      scriptManager,
      createSession,
      mode: app.options.mode,
      onError: handleError,
      app
    })

    prepareAllComponentOps(app)

    return res.component
  }

  const onComponentDeleteLocal = async (v) => {
    await triggerHook('onComponentDelete', {
      component: v,
      app
    })
  }

  // Internal helper for reading HTML files
  async function getHtmlFile (pathname) {
    // @ts-ignore
    return app.source.utils.getHtmlFile(pathname)
  }

  return {
    onPageSet: onFileSetLocal,
    onPageUpdate: onPageUpdateLocal,
    onPageDelete: onPageDeleteLocal,
    onComponentSet: onComponentSetLocal,
    onComponentUpdate: onComponentUpdateLocal,
    onComponentDelete: onComponentDeleteLocal
  }
}
