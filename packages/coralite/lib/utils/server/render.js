import { createCoraliteElement, createCoraliteTextNode } from './dom.js'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteComponentRoot,
 *  CoraliteCollectionItem
 * } from '../../../types/index.js'
 */

/**
 * @import CoraliteCollection from '../../collection.js'
 */

/**
 * Finds the <head> and <body> elements within the HTML AST.
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @returns {{ head: CoraliteElement | null, body: CoraliteElement | CoraliteComponentRoot }}
 */
export function findHeadAndBody (root) {
  let head = null
  /** @type {CoraliteElement | CoraliteComponentRoot} */
  let body = root

  for (let i = 0; i < root.children.length; i++) {
    const rootNode = root.children[i]

    if (rootNode.type === 'tag' && rootNode.name === 'html') {
      for (let j = 0; j < rootNode.children.length; j++) {
        const node = rootNode.children[j]

        if (node.type === 'tag' && node.name === 'head') {
          head = node
        }
        if (node.type === 'tag' && node.name === 'body') {
          body = node
        }
      }
      break
    }
  }

  return {
    head,
    body
  }
}

/**
 * Injects external global style link tags into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {string[]} styles - Array of style URLs.
 */
export function injectExternalStyles (root, head, styles, options = {}) {
  if (!styles || styles.length === 0) {
    return
  }

  const existingLinks = new Set()
  if (head) {
    head.children.forEach(child => {
      if (child.type === 'tag' && child.name === 'link' && child.attribs?.href) {
        existingLinks.add(child.attribs.href)
      }
    })
  }

  for (let i = 0; i < styles.length; i++) {
    const styleUrl = styles[i]

    if (existingLinks.has(styleUrl)) {
      continue
    }

    const attribs = {
      rel: 'stylesheet',
      href: styleUrl
    }
    if (options?.nonce) {
      attribs.nonce = options.nonce
    }

    const linkElement = createCoraliteElement({
      type: 'tag',
      name: 'link',
      parent: head || root,
      attribs,
      children: []
    })

    if (head) {
      head.children.push(linkElement)
    } else {
      root.children.unshift(linkElement)
    }
  }
}

/**
 * Injects external style link tags into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {string[]} stylePaths - Array of style paths.
 * @param {string} base - Base URL
 * @param {Object} [options] - Optional settings (e.g. nonce).
 */
export function injectExternalStyleLinks (root, head, stylePaths, base, options = {}) {
  if (!stylePaths || stylePaths.length === 0) {
    return
  }

  const existingLinks = new Set()
  if (head) {
    head.children.forEach(child => {
      if (child.type === 'tag' && child.name === 'link' && child.attribs?.href) {
        existingLinks.add(child.attribs.href)
      }
    })
  }

  for (let i = 0; i < stylePaths.length; i++) {
    const stylePath = stylePaths[i]
    const fullUrl = `${base}assets/css/${stylePath}`

    if (existingLinks.has(fullUrl)) {
      continue
    }

    const attribs = {
      rel: 'stylesheet',
      href: fullUrl
    }
    if (options?.nonce) {
      attribs.nonce = options.nonce
    }

    const linkElement = createCoraliteElement({
      type: 'tag',
      name: 'link',
      parent: head || root,
      attribs,
      children: []
    })

    if (head) {
      head.children.push(linkElement)
    } else {
      root.children.unshift(linkElement)
    }
  }
}

/**
 * Injects style tags into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {Map<string, string>} styles - Map of style selectors and their CSS content.
 * @param {Object} [options] - Optional settings (e.g. nonce).
 * @returns {{ element: CoraliteElement | null, content: string }}
 */
export function injectStyles (root, head, styles, options = {}) {
  if (!styles || styles.size === 0) {
    return {
      element: null,
      content: ''
    }
  }

  let cssContent = ''
  for (const [selector, css] of styles) {
    cssContent += `[data-style-selector="${selector}"] {\n${css}\n}\n`
  }

  const attribs = { id: 'coralite-inline-styles' }
  if (options?.nonce) {
    attribs.nonce = options.nonce
  }

  const styleElement = createCoraliteElement({
    type: 'tag',
    name: 'style',
    parent: head || root,
    attribs,
    children: []
  })

  styleElement.children.push(createCoraliteTextNode({
    type: 'text',
    data: cssContent,
    parent: styleElement
  }))

  if (head) {
    head.children.push(styleElement)
  } else {
    root.children.unshift(styleElement)
  }

  return {
    element: styleElement,
    content: cssContent
  }
}

/**
 * Injects the readiness script into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {boolean} hasScripts - Whether the page has scripts to wait for.
 * @param {'production' | 'development' | 'testing'} [mode] - Current build mode.
 * @param {Object} [options] - Optional settings (e.g. nonce, external).
 * @returns {{ element: CoraliteElement | null, content: string }}
 */
export function injectReadinessScript (root, head, hasScripts, mode = 'production', options = {}) {
  const isDevOrTest = mode !== 'production'
  if (!isDevOrTest) {
    if (!hasScripts) {
      if (options?.external) {
        // Set attribute on root <html> tag in SSR external mode
        /** @type {any} */
        let target = root
        if (root.children) {
          for (const child of root.children) {
            if (child.type === 'tag' && child.name === 'html') {
              target = child
              break
            }
          }
        }
        if (!target.attribs) {
          target.attribs = {}
        }
        target.attribs['data-coralite-ready'] = 'true'
        return {
          element: null,
          content: ''
        }
      }

      const scriptContent = "(() => { document.documentElement.setAttribute('data-coralite-ready', 'true'); })();"
      const attribs = { type: 'module' }
      if (options?.nonce) {
        attribs.nonce = options.nonce
      }

      const readinessScriptElement = createCoraliteElement({
        type: 'tag',
        name: 'script',
        parent: head || root,
        attribs,
        children: []
      })
      readinessScriptElement.children.push(createCoraliteTextNode({
        type: 'text',
        data: scriptContent,
        parent: readinessScriptElement
      }))
      if (head) {
        head.children.unshift(readinessScriptElement)
      } else {
        root.children.unshift(readinessScriptElement)
      }
      return {
        element: readinessScriptElement,
        content: scriptContent
      }
    }
    return {
      element: null,
      content: ''
    }
  }

  const isHydrated = !hasScripts

  const readinessScriptAttribs = { type: 'module' }
  if (options?.nonce) {
    readinessScriptAttribs.nonce = options.nonce
  }

  const readinessScriptElement = createCoraliteElement({
    type: 'tag',
    name: 'script',
    parent: head || root,
    attribs: readinessScriptAttribs,
    children: []
  })

  let data = ''
  data = `(() => {
      class CoraliteLifecycleManager {
        constructor() {
          this.defined = new Promise(r => this._dr = r);
          this.rendered = new Promise(r => this._rr = r);
          this.hydrated = new Promise(r => this._hr = r);
          this._t = 0;
          this._rc = 0;
          this._hc = 0;
          this._ts = 0;
          this._dt = new Set();
          this._ip = new WeakMap();
          this._ir = new WeakMap();
          this._rs = new WeakSet();
          this._hs = new WeakSet();
          this._s = false;
        }
        _start(t, ts) {
          this._t = t;
          this._ts = ts;
          this._s = true;
          this._check();
        }
        _check() {
          if (!this._s) return;
          if (this._rc >= this._t) this._rr();
          if (this._hc >= this._t) this._hr();
          if (this._dt.size >= this._ts) this._dr();
        }
        _markDefined(tag) {
          this._dt.add(tag);
          this._check();
        }
        _markInstanceRendered(el) {
          if (el.hasAttribute('data-coralite-initial') && !this._rs.has(el)) {
            this._rs.add(el);
            this._rc++;
            this._check();
          }
        }
        _markInstanceReady(el) {
          const r = this._ir.get(el);
          r && r();
          this._ip.set(el, Promise.resolve());
          if (el.hasAttribute('data-coralite-initial') && !this._hs.has(el)) {
            this._hs.add(el);
            this._hc++;
            this._check();
          }
        }
        waitFor(el) {
          let p = this._ip.get(el);
          if (!p) {
            p = new Promise(r => this._ir.set(el, r));
            this._ip.set(el, p);
          }
          return p;
        }
      }

      const lifecycle = new CoraliteLifecycleManager();
      if (${isHydrated}) {
        lifecycle._start(0, 0);
      }

      const devtoolsAPI = {
        version: '1.0.0',
        mode: ${JSON.stringify(mode)},
        lifecycle: lifecycle
      };

      Object.defineProperty(window, '__coralite__', {
        value: devtoolsAPI,
        writable: true,
        configurable: true,
        enumerable: false
      });

      const key = Symbol.for('coralite.testing');
      const rootTarget = document.documentElement;
      rootTarget[key] = rootTarget[key] || {};
      rootTarget[key].mode = ${JSON.stringify(mode)};
      rootTarget[key].hydrated = ${Boolean(isHydrated)};
    })();`

  readinessScriptElement.children.push(createCoraliteTextNode({
    type: 'text',
    data,
    parent: readinessScriptElement
  }))

  if (head) {
    head.children.unshift(readinessScriptElement)
  } else {
    root.children.unshift(readinessScriptElement)
  }

  return {
    element: readinessScriptElement,
    content: data
  }
}

/**
 * Injects an import map into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {Object} importMap - The import map object.
 * @param {string} base - Base URL
 * @param {Object} [options] - Optional settings (e.g. nonce).
 * @returns {{ element: CoraliteElement | null, content: string }}
 */
export function injectImportMap (root, head, importMap, base, options = {}) {
  const finalImportMap = { ...importMap }
  if (base) {
    finalImportMap['assets/js/manifest.js'] = `${base}assets/js/manifest.js`
  }

  if (Object.keys(finalImportMap).length === 0) {
    return {
      element: null,
      content: ''
    }
  }

  const importMapAttribs = { type: 'importmap' }
  if (options?.nonce) {
    importMapAttribs.nonce = options.nonce
  }

  const importMapElement = createCoraliteElement({
    type: 'tag',
    name: 'script',
    parent: head || root,
    attribs: importMapAttribs,
    children: []
  })

  const content = JSON.stringify({ imports: finalImportMap })
  importMapElement.children.push(createCoraliteTextNode({
    type: 'text',
    data: content,
    parent: importMapElement
  }))

  if (head) {
    head.children.push(importMapElement)
  } else {
    root.children.unshift(importMapElement)
  }

  return {
    element: importMapElement,
    content
  }
}

/**
 * Removes temporary and skip-render elements from the AST.
 *
 * @param {CoraliteElement[]} elements - The elements to remove.
 * @param {boolean} [matchInstance=true] - Whether to match by identity (true) or by 'remove' property (false).
 */
export function removeElements (elements, matchInstance = true) {
  if (!elements || elements.length === 0) {
    return
  }

  if (matchInstance) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      if (element.parent && element.parent.children) {
        element.parent.children = element.parent.children.filter(child => child !== element)
      }
    }
  } else {
    // Optimization: collect unique parents and filter children only once per parent
    const parents = new Set()
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].parent) {
        parents.add(elements[i].parent)
      }
    }

    for (const parent of parents) {
      if (parent.children) {
        parent.children = parent.children.filter(child => !child._markedForRemoval)
      }
    }
  }
}

/**
 * Resolves the initial queue of pages to be generated.
 *
 * @param {CoraliteCollection} pagesCollection - The collection of pages.
 * @param {string | string[]} [path] - The path(s) to include.
 * @returns {CoraliteCollectionItem[]}
 */
export function resolvePageQueue (pagesCollection, path) {
  let queue = []

  if (Array.isArray(path)) {
    const uniquePaths = new Set(path)
    for (const p of uniquePaths) {
      const result = pagesCollection.getListByPath(p) || pagesCollection.getItem(p)
      if (result) {
        if (Array.isArray(result)) {
          queue = queue.concat(result)
        } else {
          queue.push(result)
        }
      }
    }
  } else if (typeof path === 'string') {
    const result = pagesCollection.getListByPath(path) || pagesCollection.getItem(path)
    if (result) {
      if (Array.isArray(result)) {
        queue = queue.concat(result)
      } else {
        queue.push(result)
      }
    }
  } else {
    queue = pagesCollection.list.slice()
  }

  return queue
}
