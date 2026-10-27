import { definePlugin } from '../lib/server/plugin/define.js'
import { createCoraliteElement, relinkChildren } from '../lib/server/utils/dom.js'
import { findHeadAndBody } from '../lib/server/utils/render.js'
import { isDevRuntime } from '../lib/utils/dev-mode.js'

const OUTLET_CONTENT = '<template id="router-outlet"><slot></slot></template>'

/**
 * Checks if the router is active in the application based on explicit plugin registration
 * or usage of <router-outlet> / router references in registered components or pages.
 *
 * @param {Object} app - Global Coralite app instance
 * @param {string} outletAttr - Attribute name for outlet selector
 * @param {Object} [pageComponent] - Optional page component currently being rendered
 * @returns {boolean} True if router is active in the app
 */
function isRouterActive (app, outletAttr, pageComponent) {
  if (!app) {
    return false
  }

  if (app._routerActiveCache !== undefined) {
    return app._routerActiveCache
  }

  // Criterion 1: Explicit plugin registration
  if (app._explicitPluginNames && app._explicitPluginNames.has('router')) {
    app._routerActiveCache = true
    return true
  }

  // Criterion 2: Outlet element in current page AST
  if (pageComponent?.root && hasOutlet(pageComponent.root, outletAttr, app)) {
    app._routerActiveCache = true
    return true
  }

  // Criteria 2 & 3: Scan registered components and pages via parsed AST and extracted scripts
  const escapedOutletAttr = outletAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const scriptRefRegex = new RegExp(`\\brouter\\b|\\b${escapedOutletAttr}\\b`)

  const checkScriptSource = (str) => {
    if (typeof str === 'string') {
      return scriptRefRegex.test(str)
    }
    return false
  }

  const collections = [app.components?.list, app.pages?.list]
  for (const list of collections) {
    if (!list || !Array.isArray(list)) {
      continue
    }
    for (const item of list) {
      // Ignore the router plugin's own outlet component
      if (item.path?.pathname && item.path.pathname.endsWith('outlet.html')) {
        continue
      }
      if (item.result) {
        const astRoot = item.result.template || item.result.root
        if (astRoot && hasOutlet(astRoot, outletAttr, app)) {
          app._routerActiveCache = true
          return true
        }
        if (checkScriptSource(item.result.script)) {
          app._routerActiveCache = true
          return true
        }
        if (item.result.page?.hasDefinePage && checkScriptSource(item.result.page?.script)) {
          app._routerActiveCache = true
          return true
        }
      }
    }
  }

  app._routerActiveCache = false
  return false
}

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
 * @param {Object} [app] - The global Coralite app instance
 * @param {Set<string>} [visited=new Set()] - Set of visited component names to prevent recursion loops
 * @returns {boolean} True if an outlet element is found in the AST
 */
function hasOutlet (node, outletAttr, app, visited = new Set()) {
  if (!node) {
    return false
  }
  if (
    node.type === 'tag' &&
    typeof node.name === 'string' &&
    (
      node.name === 'pre' ||
      node.name === 'code' ||
      node.name === 'script' ||
      node.name === 'style'
    )
  ) {
    return false
  }
  if (isOutletElement(node, outletAttr)) {
    return true
  }
  if (node.type === 'tag' && app?.components) {
    const componentItem = app.components.getItem(node.name)
    if (componentItem?.result && !visited.has(node.name)) {
      visited.add(node.name)
      const compRoot = componentItem.result.template || componentItem.result.root
      if (compRoot && hasOutlet(compRoot, outletAttr, app, visited)) {
        return true
      }
    }
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasOutlet(child, outletAttr, app, visited)) {
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
 * @param {Object} [app] - Global Coralite app instance
 */
function wrapBodyInOutlet (component, outletAttr, app) {
  if (!component || !component.root) {
    return
  }
  const { body } = findHeadAndBody(component.root)
  if (!body) {
    return
  }

  if (hasOutlet(body, outletAttr, app)) {
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
      {
        virtual: true,
        content: OUTLET_CONTENT,
        path: {
          pathname: 'virtual:router-outlet/outlet.html',
          filename: 'outlet.html',
          dirname: 'virtual:router-outlet'
        }
      }
    ],

    onBeforePageRender ({ component, config, app }) {
      const activeConfig = config || {}
      const outletAttr = activeConfig.outlet || 'data-router-outlet'
      if (isRouterActive(app, outletAttr, component)) {
        wrapBodyInOutlet(component, outletAttr, app)
      }
    }
  },

  client: {
    init ({ config, runtime }) {
      if (typeof window === 'undefined') {
        return
      }

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

      async function performSwap (outlet, newOutlet, doc, runtime, signal) {
        if (signal && signal.aborted) {
          return false
        }
        outlet.replaceChildren(...newOutlet.childNodes)
        updateHead(doc)
        return true
      }

      function prefersReducedMotion () {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      }

      const outletAttr = config.outlet || 'data-router-outlet'
      const outletSelector = `[${outletAttr}], router-outlet`

      let currentAbort = null
      const guards = []

      function beforeEach (guard) {
        if (typeof guard !== 'function') {
          return () => {
          }
        }
        guards.push(guard)
        return () => {
          const index = guards.indexOf(guard)
          if (index !== -1) {
            guards.splice(index, 1)
          }
        }
      }

      async function navigate (path, { replace = false, depth = 0 } = {}) {
        if (depth > 10) {
          if (isDevRuntime()) {
            console.error('Redirect loop detected')
          }
          return
        }

        if (currentAbort) {
          currentAbort.abort()
        }
        const abort = new AbortController()
        currentAbort = abort
        const { signal } = abort

        const from = (typeof window !== 'undefined' && window.location) ? (window.location.pathname + window.location.search + window.location.hash) : '/'
        const to = path

        for (const guard of guards) {
          let result
          try {
            result = await guard({
              to: { path: to },
              from: { path: from },
              signal
            })
          } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
              return
            }
            if (isDevRuntime()) {
              console.error('Guard error:', error)
            }
            return
          }

          if (signal.aborted) {
            return
          }

          if (result === false) {
            return
          }

          if (typeof result === 'string' && result.length > 0) {
            if (result.startsWith('http://') || result.startsWith('https://')) {
              if (typeof window !== 'undefined' && window.location && typeof window.location.replace === 'function') {
                window.location.replace(result)
              }
              return
            }
            let redirectTarget = result
            if (!result.startsWith('/')) {
              const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost'
              const resolved = new URL(result, origin + from)
              redirectTarget = resolved.pathname + resolved.search + resolved.hash
            }
            return navigate(redirectTarget, {
              replace: true,
              depth: depth + 1
            })
          }
        }

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          const navEvent = new CustomEvent('coralite:navigating', {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: {
              from,
              to
            }
          })
          const proceed = window.dispatchEvent(navEvent)
          if (!proceed) {
            return
          }
        }

        signal.throwIfAborted()

        if (replace) {
          history.replaceState({ coralite: true }, '', to)
        } else {
          history.pushState({ coralite: true }, '', to)
        }

        try {
          const response = await fetch(to, {
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

          let newData = null
          const hydrationMatch = doc.querySelector('script[data-coralite-hydration]')
          if (hydrationMatch) {
            try {
              newData = JSON.parse(hydrationMatch.textContent || '')
            } catch (err) {
              console.error('Failed to parse hydration store during navigation:', err)
            }
          } else if (typeof doc.querySelectorAll === 'function') {
            const scripts = doc.querySelectorAll('script')
            for (let i = 0; i < scripts.length; i++) {
              const text = scripts[i].textContent || ''
              if (text.includes('__coralite_hydration__')) {
                const match = text.match(/window\.__coralite_hydration__\s*=\s*Object\.assign\(\s*\{\}\s*,\s*window\.__coralite_hydration__\s*\|\|\s*\{\}\s*,\s*([\s\S]*?)\n\s*\);/)
                if (match && match[1]) {
                  try {
                    newData = JSON.parse(match[1])
                    break
                  } catch {
                    // ignore malformed hydration JSON
                  }
                }
              }
            }
          }
          if (newData && runtime.hydrationStore && typeof runtime.hydrationStore.replace === 'function') {
            runtime.hydrationStore.replace(newData)
          }

          const outlet = document.querySelector(outletSelector)
          if (!outlet) {
            throw new Error('No outlet found in current document')
          }

          let didSwap = false
          /** @type {any} */
          const win = window
          const activeVT = win.__coralite_hydration__?.viewTransitions ?? win.__coralite_router__?.viewTransitions ?? false
          const shouldAnimate =
            activeVT === true &&
            typeof document.startViewTransition === 'function' &&
            !prefersReducedMotion()

          if (shouldAnimate) {
            try {
              const transition = document.startViewTransition(async () => {
                if (signal.aborted) {
                  return
                }
                didSwap = await performSwap(outlet, newOutlet, doc, runtime, signal)
              })
              await transition.finished
            } catch (err) {
              if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
                return
              }
              if (signal.aborted) {
                return
              }
              if (!didSwap) {
                didSwap = await performSwap(outlet, newOutlet, doc, runtime, signal)
              }
            }
          } else {
            didSwap = await performSwap(outlet, newOutlet, doc, runtime, signal)
          }

          if (typeof runtime.upgrade === 'function') {
            await runtime.upgrade(outlet)
          }
          signal.throwIfAborted()

          if (!path.includes('#')) {
            window.scrollTo(0, 0)
          }

          signal.throwIfAborted()

          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('coralite:navigated', {
              bubbles: true,
              composed: true,
              detail: {
                from,
                to
              }
            }))
          }
        } catch (error) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
            return
          }
          throw error
        }
      }

      /** @type {Object} */
      const win = typeof window !== 'undefined' ? window : {}
      win.__coralite_router__ = {
        navigate,
        current: () => ({ path: window.location ? window.location.pathname : '/' }),
        beforeEach,
        get viewTransitions () {
          return win.__coralite_hydration__?.viewTransitions ?? false
        }
      }

      const handleLinkClick = (event) => {
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
      }

      const outlet = document.querySelector(outletSelector)
      if (outlet) {
        outlet.addEventListener('click', handleLinkClick)
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('click', handleLinkClick)
        }
      }

      window.addEventListener('popstate', () => {
        if (!document.querySelector(outletSelector)) {
          return
        }
        const currentPath = window.location ? (window.location.pathname + window.location.search + window.location.hash) : '/'
        navigate(currentPath, { replace: true })
      })
    },

    context: (_pluginContext) => (_instanceContext) => ({
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
      },
      beforeEach: (guard) => {
        /** @type {any} */
        const win = typeof window !== 'undefined' ? window : {}
        const router = win.__coralite_router__
        if (router && typeof router.beforeEach === 'function') {
          return router.beforeEach(guard)
        }
        return () => {
        }
      }
    })
  }
})

export default routerPlugin
