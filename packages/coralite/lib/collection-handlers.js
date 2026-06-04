import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseHTML, parseModule } from './parse.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteOnError
 * } from '../types/index.js'
 */

/**
 * Factory for collection handlers.
 *
 * @param {Object} dependencies
 * @param {CoraliteInstance} dependencies.app
 * @param {Object} dependencies.pageCustomElements
 * @param {Object} dependencies.childCustomElements
 * @param {Function} dependencies.triggerHook
 * @param {CoraliteOnError} dependencies.handleError
 * @returns {Object}
 */
export function createPageHandlers ({
  app,
  pageCustomElements,
  childCustomElements,
  triggerHook,
  handleError
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

    if (app.options.mode !== 'production') {
      const customElementsList = elements && elements.customElements ? elements.customElements : []
      for (let i = 0; i < customElementsList.length; i++) {
        const name = customElementsList[i].name
        if (!pageCustomElements[name]) {
          pageCustomElements[name] = new Set()
          const component = app.components.getItem(name)

          if (component && component.result && component.result.customElements && component.result.customElements.length) {
            const stack = [component.result.customElements]

            while (stack.length > 0) {
              const current = stack.pop()

              for (let i = 0; i < current.length; i++) {
                const element = current[i]

                if (!childCustomElements[element.name]) {
                  childCustomElements[element.name] = name
                  const comp = app.components.getItem(element.name)

                  if (comp && comp.result && comp.result.customElements && comp.result.customElements.length) {
                    stack.push(comp.result.customElements)
                  }
                }
              }
            }
          }
        }
        pageCustomElements[name].add(data.path.pathname)
      }
    }

    const mappedContext = await triggerHook('onPageSet', {
      elements,
      state,
      page,
      data,
      app
    })
    const isProduction = app.options.mode === 'production'
    if (isProduction && data.physical) {
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
      return newValue.result
    }
    let newCustomElements
    if (!newValue.result) {
      const res = await onFileSetLocal(newValue); newValue.result = res.value; newCustomElements = res.value.customElements
    } else {
      newCustomElements = newValue.result.customElements
    }
    const oldElements = (oldValue.result.customElements || []).slice()
    const mappedContext = await triggerHook('onPageUpdate', {
      elements: newValue.result,
      page: newValue.result.page,
      newValue,
      oldValue,
      app
    })
    newValue.result = mappedContext.elements; newValue = mappedContext.newValue
    for (let i = 0; i < newCustomElements.length; i++) {
      const name = newCustomElements[i].name
      let hasElement = false
      for (let j = 0; j < oldElements.length; j++) {
        if (name === oldElements[j].name) {
          hasElement = true; oldElements.splice(j, 1); break
        }
      }
      if (!hasElement) {
        if (!pageCustomElements[name]) {
          pageCustomElements[name] = new Set()
        } pageCustomElements[name].add(newValue.path.pathname)
      }
    }
    oldElements.forEach(oe => {
      if (pageCustomElements[oe.name]) {
        pageCustomElements[oe.name].delete(newValue.path.pathname)
      }
    })
    return newValue.result
  }

  const onPageDeleteLocal = async (value) => {
    if (app.options.mode === 'production') {
      return
    }
    const res = await triggerHook('onPageDelete', {
      data: value,
      app
    })
    value = res.data
    if (value?.result?.customElements) {
      value.result.customElements.forEach(ce => {
        const ceName = typeof ce === 'string' ? ce : ce.name
        if (pageCustomElements[ceName]) {
          pageCustomElements[ceName].delete(value.path.pathname)
        }
      })
    }
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
