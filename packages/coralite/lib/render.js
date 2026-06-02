import { createCoraliteElement, createCoraliteTextNode } from './dom.js'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteComponentRoot,
 *  CoraliteCollectionItem
 * } from '../types/index.js'
 */

/**
 * @import CoraliteCollection from './collection.js'
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
    attribs: {},
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
 */
export function injectReadinessScript (root, head, hasScripts) {
  const readinessScriptElement = createCoraliteElement({
    type: 'tag',
    name: 'script',
    parent: head || root,
    attribs: {},
    children: []
  })

  const data = hasScripts
    ? 'window.__coralite_ready__ = new Promise(resolve => { window.__coralite_resolve_ready__ = resolve; });'
    : 'window.__coralite_ready__ = Promise.resolve(); window.__coralite_resolve_ready__ = () => {};'

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
        parent.children = parent.children.filter(child => !child.remove)
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
