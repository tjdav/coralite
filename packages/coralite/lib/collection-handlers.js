import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseHTML, parseModule } from './utils/server/parse.js'
import { registerBaseComponent } from './component-setup.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteOnError
 * } from '../types/index.js'
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
    const urlPathname = pathToFileURL(join('/', relative(rootPath, data.path.pathname))).pathname
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
      meta: data.state?.page?.meta || {}
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

    const mappedContext = await triggerHook('onPageSet', {
      elements,
      state,
      page,
      data,
      app
    })

    const isProduction = app.options.mode === 'production'
    if (isProduction && !data.virtual) {
      delete data.content
    }

    return {
      type: 'page',
      value: {
        state: mappedContext.state,
        page: mappedContext.page,
        path: mappedContext.data.path,
        root: isProduction ? null : mappedContext.elements.root,
        customElements: isProduction ? null : mappedContext.elements.customElements,
        tempElements: isProduction ? null : mappedContext.elements.tempElements,
        skipRenderElements: isProduction ? null : mappedContext.elements.skipRenderElements
      },
      state: mappedContext.state
    }
  }

  const onPageUpdateLocal = async (newValue, oldValue) => {
    if (app.options.mode === 'production') {
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

    const component = parseModule(v.content, {
      ignoreByAttribute: app.options.ignoreByAttribute,
      skipRenderByAttribute: app.options.skipRenderByAttribute,
      onError: handleError
    })

    if (!component.isTemplate) {
      return
    }

    const res = await triggerHook('onComponentSet', {
      component,
      app
    })

    return {
      type: 'component',
      id: res.component.id,
      value: res.component
    }
  }

  const onComponentUpdateLocal = async (v) => {
    if (v.content === undefined) {
      v.content = await getHtmlFile(v.path.pathname)
    }

    const component = parseModule(v.content, {
      ignoreByAttribute: app.options.ignoreByAttribute,
      skipRenderByAttribute: app.options.skipRenderByAttribute,
      onError: handleError
    })

    if (!component.isTemplate) {
      return
    }

    const res = await triggerHook('onComponentUpdate', {
      component,
      app
    })

    await registerBaseComponent({
      component: res.component,
      evaluate,
      scriptManager,
      createSession,
      mode: app.options.mode
    })

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
