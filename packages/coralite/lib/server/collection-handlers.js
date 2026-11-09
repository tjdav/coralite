import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseHTML, parseModule } from './utils/parse.js'
import { extractPageScript, createIgnoredSlotsResolver } from './parser/html.js'
import { registerBaseComponent } from './component-setup.js'
import { prepareAllComponentOps } from './utils/fragment.js'
import { validateEnumeratedPaths, validatePluginEnumeratedPaths, deduplicateEnumeratedPaths } from './route.js'
import { parsePagePattern } from './page/pattern.js'
import { resolvePageMetaDefaults } from '../shared/page-meta.js'
import { extractScriptStylesheets } from './utils/dependency-stylesheets.js'
import { CoraliteError } from '../shared/errors.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteOnError
 * } from '../../types/index.js'
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
    const fixturesPages = app.fixtures?.rootDir || app.options.fixtures?.pages
    const isFixturePage = fixturesPages && data.path.pathname.startsWith(fixturesPages)
    let rootPath
    if (isFixturePage) {
      rootPath = fixturesPages
    } else if (data.type === 'component') {
      rootPath = app.options.path.components
    } else {
      rootPath = app.options.path.pages
    }
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

    let elements = null
    let pageSetupError = null
    if (data.content !== undefined) {
      try {
        elements = parseHTML(data.content, app.options.ignoreByAttribute, app.options.skipRenderByAttribute, handleError)
      } catch (err) {
        pageSetupError = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
          cause: err,
          filePath: data.path.pathname
        })
      }
    }

    let parsedScript = {
      hasDefinePage: false,
      hasPageExports: false,
      blocks: null,
      script: null,
      lineOffset: 0,
      tag: null
    }
    if (elements) {
      try {
        parsedScript = extractPageScript(elements, {
          filePath: data.path.pathname,
          rawContent: data.content,
          getIgnoredSlots: createIgnoredSlotsResolver(app.components)
        })
      } catch (err) {
        pageSetupError = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
          code: err.code || 'CORALITE-E402',
          cause: err,
          filePath: data.path.pathname
        })
        pageSetupError.filePath = pageSetupError.filePath || data.path.pathname

        if (pageSetupError.code !== 'CORALITE-E107' && typeof handleError === 'function') {
          handleError({
            level: 'ERR',
            code: pageSetupError.code,
            message: pageSetupError.message,
            error: pageSetupError,
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
      hasPageExports: parsedScript.hasPageExports,
      script: parsedScript.script,
      scriptLineOffset: parsedScript.lineOffset,
      routePattern,
      routeParams,
      routeSegments,
      is404: relPath === '404.html',
      enumeratedPaths: []
    }

    if (pageSetupError) {
      page.failed = true
      page.error = pageSetupError
    }

    const contributions = []
    let pageMetaDefaults = {}

    if (parsedScript.script && evaluate && !page.failed) {
      try {
        const { code: transformedPageScript, declarations } = extractScriptStylesheets(parsedScript.script, {
          filePath: data.path.pathname
        })
        if (scriptManager && typeof scriptManager.registerPageStylesheets === 'function') {
          scriptManager.registerPageStylesheets(data.path.pathname, declarations)
        }

        const module = {
          id: data.path.pathname,
          script: transformedPageScript,
          path: data.path,
          lineOffset: parsedScript.lineOffset || 0
        }

        const pageExports = await evaluate({
          module,
          page,
          app,
          source: app.source || { utils: {} },
          mode: app.options.mode,
          isPage: true
        })

        if (pageExports) {
          Object.defineProperty(page, 'exports', {
            value: pageExports,
            enumerable: false,
            writable: true,
            configurable: true
          })
          if (pageExports.meta !== undefined) {
            pageMetaDefaults = resolvePageMetaDefaults(pageExports.meta, {
              filePath: data.path.pathname
            })
            Object.defineProperty(page, 'metaDefaults', {
              value: pageMetaDefaults,
              enumerable: false,
              writable: true,
              configurable: true
            })
          }
          if (typeof pageExports.paths === 'function') {
            const rawPaths = await pageExports.paths({ app })
            validateEnumeratedPaths(rawPaths, routeParams, data.path.pathname)
            contributions.push({
              source: 'definePage.paths',
              paths: rawPaths
            })
          }
        } else if (scriptManager && typeof scriptManager.unregisterPageStylesheets === 'function') {
          scriptManager.unregisterPageStylesheets(data.path.pathname)
        }
      } catch (err) {
        if (scriptManager && typeof scriptManager.unregisterPageStylesheets === 'function') {
          scriptManager.unregisterPageStylesheets(data.path.pathname)
        }
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
              message: `Failed to evaluate page configuration for "${data.path.pathname}": ${pageErr.message}`,
              error: pageErr,
              filePath: data.path.pathname
            })
          } else if (typeof handleError === 'function') {
            handleError({
              level: 'ERR',
              code: pageErr.code,
              message: `Failed to evaluate page configuration for "${data.path.pathname}": ${pageErr.message}`,
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
      ...pageMetaDefaults,
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

    const directPageComponents = app._dependencyGraph.directPageComponents

    if (elements && elements.customElements && directPageComponents) {
      const pagePath = data.path.pathname
      const hadPrevious = Object.hasOwn(directPageComponents, pagePath)
      const directComponents = elements.customElements.map(el => el.name)

      directPageComponents[pagePath] = directComponents

      if (typeof app._updatePageDependencies === 'function') {
        app._updatePageDependencies(pagePath, directComponents, hadPrevious)
      } else {
        app._refreshDependencyGraph()
      }
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

    if (mappedContext.elements !== elements && elements.skipRenderElements?.length && mappedContext.elements) {
      const current = mappedContext.elements.skipRenderElements || []
      mappedContext.elements.skipRenderElements = [
        ...current,
        ...elements.skipRenderElements.filter(element => !current.includes(element))
      ]
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

  const refreshPageStylesheets = (value) => {
    if (!scriptManager || typeof scriptManager.registerPageStylesheets !== 'function') {
      return
    }

    const filePath = value.path?.pathname
    const pageScript = value.page?.script
    if (!filePath || !pageScript) {
      if (filePath && typeof scriptManager.unregisterPageStylesheets === 'function') {
        scriptManager.unregisterPageStylesheets(filePath)
      }
      return
    }

    try {
      const { declarations } = extractScriptStylesheets(pageScript, { filePath })
      scriptManager.registerPageStylesheets(filePath, declarations)
    } catch {
      /* keep existing registrations when dev re-evaluation fails */
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

    refreshPageStylesheets(newValue)

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

    const elements = mappedContext.elements
    const directPageComponents = app._dependencyGraph.directPageComponents
    const pagePath = newValue.path.pathname

    if (directPageComponents) {
      const hadPrevious = Object.hasOwn(directPageComponents, pagePath)
      if (elements && elements.customElements) {
        const directComponents = elements.customElements.map(el => el.name)
        directPageComponents[pagePath] = directComponents
        if (typeof app._updatePageDependencies === 'function') {
          app._updatePageDependencies(pagePath, directComponents, hadPrevious)
        } else {
          app._refreshDependencyGraph()
        }
      } else {
        delete directPageComponents[pagePath]
        if (typeof app._updatePageDependencies === 'function') {
          app._updatePageDependencies(pagePath, [], hadPrevious)
        } else {
          app._refreshDependencyGraph()
        }
      }
    } else {
      app._refreshDependencyGraph()
    }

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

    if (pathname && scriptManager && typeof scriptManager.unregisterPageStylesheets === 'function') {
      scriptManager.unregisterPageStylesheets(pathname)
    }

    if (pathname && directPageComponents) {
      const hadPrevious = Object.hasOwn(directPageComponents, pathname)
      delete directPageComponents[pathname]
      if (typeof app._updatePageDependencies === 'function') {
        app._updatePageDependencies(pathname, [], hadPrevious)
      } else {
        app._refreshDependencyGraph()
      }
    } else {
      app._refreshDependencyGraph()
    }
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
      const compErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        code: err.code || 'CORALITE-E402',
        cause: err,
        filePath: v.path?.pathname
      })
      compErr.filePath = compErr.filePath || v.path?.pathname

      try {
        if (typeof app.onError === 'function') {
          app.onError({
            level: 'ERR',
            code: compErr.code,
            message: `Failed to parse component "${v.path?.pathname}": ${compErr.message}`,
            error: compErr,
            filePath: v.path?.pathname
          })
        } else if (typeof handleError === 'function') {
          handleError({
            level: 'ERR',
            code: compErr.code,
            message: `Failed to parse component "${v.path?.pathname}": ${compErr.message}`,
            error: compErr,
            filePath: v.path?.pathname
          })
        }
      } catch {
        /* ignore throw to preserve collection loading */
      }
      return null
    }

    if (!component || !component.isTemplate) {
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
        onError: handleError,
        filePath: v.path?.pathname
      })
    } catch (err) {
      const compErr = err instanceof CoraliteError ? err : new CoraliteError(err.message, {
        code: err.code || 'CORALITE-E402',
        cause: err,
        filePath: v.path?.pathname
      })
      compErr.filePath = compErr.filePath || v.path?.pathname

      try {
        if (typeof app.onError === 'function') {
          app.onError({
            level: 'ERR',
            code: compErr.code,
            message: `Failed to parse component "${v.path?.pathname}": ${compErr.message}`,
            error: compErr,
            filePath: v.path?.pathname
          })
        } else if (typeof handleError === 'function') {
          handleError({
            level: 'ERR',
            code: compErr.code,
            message: `Failed to parse component "${v.path?.pathname}": ${compErr.message}`,
            error: compErr,
            filePath: v.path?.pathname
          })
        }
      } catch {
        /* ignore throw to preserve collection loading */
      }
      return null
    }

    if (!component || !component.isTemplate) {
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
