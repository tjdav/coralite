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
export function injectExternalStyles (root, head, styles) {
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

    const linkElement = createCoraliteElement({
      type: 'tag',
      name: 'link',
      parent: head || root,
      attribs: {
        rel: 'stylesheet',
        href: styleUrl
      },
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
 */
/**
 * Injects external style link tags into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {string[]} stylePaths - Array of style paths.
 * @param {string} base - Base URL
 */
export function injectExternalStyleLinks (root, head, stylePaths, base) {
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

    const linkElement = createCoraliteElement({
      type: 'tag',
      name: 'link',
      parent: head || root,
      attribs: {
        rel: 'stylesheet',
        href: fullUrl
      },
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
 *
 */
export function injectStyles (root, head, styles) {
  if (!styles || styles.size === 0) {
    return
  }

  let cssContent = ''
  for (const [selector, css] of styles) {
    cssContent += `[data-style-selector="${selector}"] {\n${css}\n}\n`
  }

  const styleElement = createCoraliteElement({
    type: 'tag',
    name: 'style',
    parent: head || root,
    attribs: { id: 'coralite-inline-styles' },
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
}

/**
 * Injects the readiness script into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {boolean} hasScripts - Whether the page has scripts to wait for.
 * @param {'production' | 'development' | 'testing'} [mode] - Current build mode.
 */
export function injectReadinessScript (root, head, hasScripts, mode) {
  const readinessScriptElement = createCoraliteElement({
    type: 'tag',
    name: 'script',
    parent: head || root,
    attribs: {},
    children: []
  })

  let data = 'class CoraliteLifecycleManager { constructor() { this.defined = new Promise(r => this._dr = r); this.rendered = new Promise(r => this._rr = r); this.hydrated = new Promise(r => this._hr = r); this._t = 0; this._rc = 0; this._hc = 0; this._ts = 0; this._dt = new Set(); this._ip = new WeakMap(); this._ir = new WeakMap(); this._rs = new WeakSet(); this._hs = new WeakSet(); this._s = false; } _start(t, ts) { this._t = t; this._ts = ts; this._s = true; this._check(); } _check() { if (!this._s) return; if (this._rc >= this._t) this._rr(); if (this._hc >= this._t) this._hr(); if (this._dt.size >= this._ts) this._dr(); } _markDefined(tag) { this._dt.add(tag); this._check(); } _markInstanceRendered(el) { if (el.hasAttribute(\'data-coralite-initial\') && !this._rs.has(el)) { this._rs.add(el); this._rc++; this._check(); } } _markInstanceReady(el) { const r = this._ir.get(el); r && r(); this._ip.set(el, Promise.resolve()); if (el.hasAttribute(\'data-coralite-initial\') && !this._hs.has(el)) { this._hs.add(el); this._hc++; this._check(); } } waitFor(el) { let p = this._ip.get(el); if (!p) { p = new Promise(r => this._ir.set(el, r)); this._ip.set(el, p); } return p; } } window.__coralite__ = { lifecycle: new CoraliteLifecycleManager() };'

  if (mode === 'testing') {
    data += ' window.__coralite__.components = {}; window.__coralite__.events = [];'
  }

  if (!hasScripts) {
    data += ' window.__coralite__.lifecycle._start(0, 0);'
  }

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
}

/**
 * Injects an import map into the document head (or root if head is missing).
 *
 * @param {CoraliteComponentRoot} root - The root of the AST.
 * @param {CoraliteElement | null} head - The head element.
 * @param {Object} importMap - The import map object.
 */
export function injectImportMap (root, head, importMap) {
  if (!importMap || Object.keys(importMap).length === 0) {
    return
  }

  const importMapElement = createCoraliteElement({
    type: 'tag',
    name: 'script',
    parent: head || root,
    attribs: {
      type: 'importmap'
    },
    children: []
  })

  importMapElement.children.push(createCoraliteTextNode({
    type: 'text',
    data: JSON.stringify({ imports: importMap }),
    parent: importMapElement
  }))

  if (head) {
    head.children.push(importMapElement)
  } else {
    root.children.unshift(importMapElement)
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
