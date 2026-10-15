import { definePlugin } from '../lib/server/plugin/define.js'
import { createCoraliteElement, relinkChildren } from '../lib/server/utils/dom.js'
import { findHeadAndBody } from '../lib/server/utils/render.js'
import { fileURLToPath } from 'node:url'

/**
 * Checks if an element is a router outlet element either by tag name or attribute match.
 *
 * @param {any} node - The AST node to inspect
 * @param {string} outletAttr - The attribute name identifying the outlet
 * @returns {boolean} True if the node is an outlet element
 */
function isOutletElement (node, outletAttr) {
  if (!node || node.type !== 'tag') {
    return false
  }
  if (node.name === 'router-outlet') {
    return true
  }
  if (node.attribs && Object.hasOwn(node.attribs, outletAttr)) {
    return true
  }
  return false
}

/**
 * Recursively checks if an AST container or its children already contains an outlet element.
 *
 * @param {any} node - The AST node/container to check
 * @param {string} outletAttr - The attribute name identifying the outlet
 * @returns {boolean} True if an outlet element is found in the AST
 */
function hasOutlet (node, outletAttr) {
  if (!node) {
    return false
  }
  if (isOutletElement(node, outletAttr)) {
    return true
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasOutlet(child, outletAttr)) {
        return true
      }
    }
  }
  return false
}

/**
 * Wraps page body content in a <router-outlet> element if not already present.
 *
 * @param {Object} component - Coralite component object containing root AST
 * @param {string} outletAttr - Attribute name for outlet selector
 */
function wrapBodyInOutlet (component, outletAttr) {
  if (!component || !component.root) {
    return
  }
  const { body } = findHeadAndBody(component.root)
  if (!body) {
    return
  }

  if (hasOutlet(body, outletAttr)) {
    return
  }

  const existingChildren = body.children || []
  const outletElement = createCoraliteElement({
    type: 'tag',
    name: 'router-outlet',
    attribs: {
      [outletAttr]: ''
    },
    children: existingChildren
  })

  body.children = [outletElement]
  relinkChildren(body)
}

export const routerPlugin = definePlugin({
  name: 'router',

  config: {
    base: {
      type: String,
      default: '/'
    },
    outlet: {
      type: String,
      default: 'data-router-outlet'
    }
  },

  server: {
    components: [
      fileURLToPath(new URL('./router/outlet.html', import.meta.url))
    ],

    onBeforePageRender ({ component, config }) {
      const activeConfig = config || {}
      const outletAttr = activeConfig.outlet || 'data-router-outlet'
      wrapBodyInOutlet(component, outletAttr)
    }
  },

  client: {
    init ({ config, runtime }) {
      if (typeof window === 'undefined') {
        return
      }

      const outletAttr = config.outlet || 'data-router-outlet'
      const outletSelector = `[${outletAttr}], router-outlet`

      let currentAbort = null

      function updateHead (doc) {
        const newTitle = doc.querySelector('title')
        if (newTitle) {
          document.title = newTitle.textContent
        }

        const currentMetas = document.head.querySelectorAll('meta[name], meta[property]')
        const newMetas = doc.head.querySelectorAll('meta[name], meta[property]')

        const newMetaMap = new Map()
        for (let i = 0; i < newMetas.length; i++) {
          const meta = newMetas[i]
          const key = meta.getAttribute('name') || meta.getAttribute('property')
          if (key) {
            newMetaMap.set(key, meta)
          }
        }

        for (let i = 0; i < currentMetas.length; i++) {
          const meta = currentMetas[i]
          const key = meta.getAttribute('name') || meta.getAttribute('property')
          if (key) {
            if (!newMetaMap.has(key)) {
              meta.remove()
            }
          }
        }

        for (const [key, newMeta] of newMetaMap.entries()) {
          const existing = document.head.querySelector(`meta[name="${key}"], meta[property="${key}"]`)
          if (existing) {
            existing.setAttribute('content', newMeta.getAttribute('content') || '')
          } else {
            const clone = newMeta.cloneNode(true)
            document.head.appendChild(clone)
          }
        }
      }

      async function navigate (path, { replace = false } = {}) {
        if (currentAbort) {
          currentAbort.abort()
        }
        const abort = new AbortController()
        currentAbort = abort
        const { signal } = abort

        if (replace) {
          history.replaceState({ coralite: true }, '', path)
        } else {
          history.pushState({ coralite: true }, '', path)
        }

        try {
          const response = await fetch(path, {
            signal,
            headers: {
              'X-Coralite-Router': 'true'
            }
          })
          if (!response.ok) {
            throw new Error(`Navigation to ${path} failed: ${response.status}`)
          }
          const html = await response.text()
          signal.throwIfAborted()

          const doc = new DOMParser().parseFromString(html, 'text/html')

          const newOutlet = doc.querySelector(outletSelector)
          if (!newOutlet) {
            throw new Error('No outlet found in fetched document')
          }

          const hydrationMatch = doc.querySelector('script[data-coralite-hydration]')
          if (hydrationMatch) {
            try {
              const newData = JSON.parse(hydrationMatch.textContent)
              if (runtime.hydrationStore && typeof runtime.hydrationStore.replace === 'function') {
                runtime.hydrationStore.replace(newData)
              }
            } catch (err) {
              console.error('Failed to parse hydration store during navigation:', err)
            }
          }

          const outlet = document.querySelector(outletSelector)
          if (!outlet) {
            throw new Error('No outlet found in current document')
          }
          outlet.replaceChildren(...newOutlet.childNodes)
          signal.throwIfAborted()

          if (typeof runtime.upgrade === 'function') {
            await runtime.upgrade(outlet)
          }
          signal.throwIfAborted()

          updateHead(doc)

          if (!path.includes('#')) {
            window.scrollTo(0, 0)
          }
        } catch (error) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
            return
          }
          throw error
        }
      }

      /** @type {Object} */
      const win = window
      win.__coralite_router__ = {
        navigate,
        current: () => ({ path: window.location ? window.location.pathname : '/' })
      }

      const outlet = document.querySelector(outletSelector)
      if (outlet) {
        outlet.addEventListener('click', (event) => {
          /** @type {any} */
          const mouseEvent = event
          if (mouseEvent.defaultPrevented) {
            return
          }
          if (mouseEvent.button !== 0) {
            return
          }
          if (mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey) {
            return
          }

          /** @type {any} */
          const targetEl = mouseEvent.target
          const link = targetEl ? targetEl.closest('a[href]') : null
          if (!link) {
            return
          }
          if (link.target && link.target !== '_self') {
            return
          }
          if (link.hasAttribute && link.hasAttribute('download')) {
            return
          }
          if (link.hasAttribute && link.hasAttribute('data-router-ignore')) {
            return
          }

          const currentOrigin = window.location ? window.location.origin : ''
          const url = new URL(link.href, currentOrigin)
          if (url.origin !== currentOrigin) {
            return
          }

          mouseEvent.preventDefault()
          navigate(url.pathname + url.search + url.hash)
        })
      }

      window.addEventListener('popstate', () => {
        const currentPath = window.location ? (window.location.pathname + window.location.search + window.location.hash) : '/'
        navigate(currentPath, { replace: true })
      })
    },

    context: (_pluginContext) => (_instanceContext) => ({
      router: {
        navigate: (path, options) => {
          /** @type {any} */
          const win = typeof window !== 'undefined' ? window : {}
          const router = win.__coralite_router__
          if (router && typeof router.navigate === 'function') {
            return router.navigate(path, options)
          }
        },
        current: () => {
          /** @type {any} */
          const win = typeof window !== 'undefined' ? window : {}
          const router = win.__coralite_router__
          return router ? router.current() : { path: typeof window !== 'undefined' && window.location ? window.location.pathname : '/' }
        }
      }
    })
  }
})

export default routerPlugin
