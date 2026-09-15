import { render } from 'dom-serializer'
import { parseHTML } from './parse.js'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteComponentRoot,
 *  CoraliteComment,
 *  CoraliteDirective,
 *  RawCoraliteElement,
 *  RawCoraliteTextNode,
 *  RawCoraliteComment,
 *  RawCoraliteDirective,
 *  RawCoraliteComponentRoot
 * } from '../../../types/index.js'
 */

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const COMMENT_NODE = 8
const DOCUMENT_NODE = 9
const DOCUMENT_TYPE_NODE = 10

const nodeTypes = {
  tag: ELEMENT_NODE,
  script: ELEMENT_NODE,
  style: ELEMENT_NODE,
  text: TEXT_NODE,
  comment: COMMENT_NODE,
  root: DOCUMENT_NODE,
  directive: DOCUMENT_TYPE_NODE
}

const PARENT_SYM = Symbol('parent')
const PREV_SYM = Symbol('prev')
const NEXT_SYM = Symbol('next')
const SLOTS_SYM = Symbol('slots')
const LISTENERS_SYM = Symbol('listeners')
const STYLE_PROXY_SYM = Symbol('styleProxy')
const DATASET_PROXY_SYM = Symbol('datasetProxy')

/**
 * Ensures circular properties are non-enumerable to prevent serialization issues.
 * @param {any} node - The node to enhance
 */
function makeCircularPropertiesNonEnumerable (node) {
  for (const key of ['parent', 'prev', 'next', 'slots']) {
    if (Object.hasOwn(node, key)) {
      const val = node[key]
      delete node[key]
      if (val !== undefined) {
        node[key] = val
      }
    }
  }
}

/**
 * Converts kebab-case to camelCase string.
 * @param {string} str - String to convert
 */
function kebabToCamel (str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Converts camelCase to kebab-case string.
 * @param {string} str - String to convert
 */
function camelToKebab (str) {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

/**
 * Parses numeric dimension from inline style or attribute.
 * @param {string} [styleStr] - Inline style string
 * @param {string} [prop='width'] - Property name
 * @returns {number}
 */
function parseDimension (styleStr, prop = 'width') {
  if (!styleStr || typeof styleStr !== 'string') {
    return 0
  }
  const styleMap = parseStyleString(styleStr)
  const val = styleMap[prop]
  if (!val) {
    return 0
  }
  const num = parseFloat(val)
  return isNaN(num) ? 0 : num
}

/**
 * Parses an inline style string into a key-value object (kebab-case keys).
 * @param {string} styleStr - Inline style string
 * @returns {Record<string, string>}
 */
function parseStyleString (styleStr) {
  /** @type {Record<string, string>} */
  const result = {}
  if (!styleStr || typeof styleStr !== 'string') {
    return result
  }
  const declarations = styleStr.split(';')
  for (let i = 0; i < declarations.length; i++) {
    const decl = declarations[i].trim()
    if (!decl) {
      continue
    }
    const colonIdx = decl.indexOf(':')
    if (colonIdx > -1) {
      const prop = decl.slice(0, colonIdx).trim().toLowerCase()
      const val = decl.slice(colonIdx + 1).trim()
      if (prop && val) {
        result[prop] = val
      }
    }
  }
  return result
}

/**
 * Serializes a key-value style map back to an inline CSS style string.
 * @param {Record<string, string>} styleMap - Key-value style map
 * @returns {string}
 */
function serializeStyleMap (styleMap) {
  const parts = []
  for (const prop in styleMap) {
    if (Object.prototype.hasOwnProperty.call(styleMap, prop) && styleMap[prop]) {
      parts.push(`${prop}: ${styleMap[prop]}`)
    }
  }
  return parts.length ? parts.join('; ') + ';' : ''
}

/**
 * Base prototype for all Coralite nodes.
 */
const CoraliteNodePrototype = {
  /**
   * Removes the node from its parent's children list and updates siblings.
   */
  remove () {
    if (this.parent && this.parent.children) {
      const index = this.parent.children.indexOf(this)
      if (index > -1) {
        this.parent.children.splice(index, 1)
      }
    }

    // Re-stitch the linked list
    if (this.prev) {
      this.prev.next = this.next
    }
    if (this.next) {
      this.next.prev = this.prev
    }

    this.parent = null
    this.next = null
    this.prev = null
  },

  /**
   * Adds an event listener to the node.
   * @param {string} type - Event type
   * @param {Function|{handleEvent: Function}} listener - Event listener
   * @param {Object} [options={}] - Event listener options
   */
  addEventListener (type, listener, options = {}) {
    if (typeof listener !== 'function' && (!listener || typeof listener.handleEvent !== 'function')) {
      return
    }
    if (!this[LISTENERS_SYM]) {
      this[LISTENERS_SYM] = new Map()
    }
    if (!this[LISTENERS_SYM].has(type)) {
      this[LISTENERS_SYM].set(type, new Set())
    }

    const listenerRecord = {
      listener,
      options,
      once: Boolean(options?.once)
    }

    if (options?.signal) {
      if (options.signal.aborted) {
        return
      }
      options.signal.addEventListener('abort', () => {
        this.removeEventListener(type, listener)
      }, { once: true })
    }

    this[LISTENERS_SYM].get(type).add(listenerRecord)
  },

  /**
   * Removes an event listener from the node.
   * @param {string} type - Event type
   * @param {Function|{handleEvent: Function}} listener - Event listener
   */
  removeEventListener (type, listener) {
    if (!this[LISTENERS_SYM] || !this[LISTENERS_SYM].has(type)) {
      return
    }
    const set = this[LISTENERS_SYM].get(type)
    for (const record of set) {
      if (record.listener === listener) {
        set.delete(record)
        break
      }
    }
  },

  /**
   * Dispatches an event to the node and optionally bubbles up ancestor chain.
   * @param {any} event - Event object to dispatch
   * @returns {boolean}
   */
  dispatchEvent (event) {
    if (!event || typeof event.type !== 'string') {
      throw new TypeError('Failed to execute "dispatchEvent": parameter 1 is not of type "Event".')
    }

    let stopPropagationFlag = false
    let stopImmediatePropagationFlag = false

    const origStopPropagation = event.stopPropagation
    const origStopImmediatePropagation = event.stopImmediatePropagation

    event.stopPropagation = function () {
      stopPropagationFlag = true
      if (typeof origStopPropagation === 'function') {
        origStopPropagation.call(event)
      }
    }

    event.stopImmediatePropagation = function () {
      stopPropagationFlag = true
      stopImmediatePropagationFlag = true
      if (typeof origStopImmediatePropagation === 'function') {
        origStopImmediatePropagation.call(event)
      }
    }

    Object.defineProperty(event, 'target', {
      value: this,
      configurable: true,
      writable: true
    })

    let current = this
    while (current) {
      Object.defineProperty(event, 'currentTarget', {
        value: current,
        configurable: true,
        writable: true
      })

      if (current[LISTENERS_SYM] && current[LISTENERS_SYM].has(event.type)) {
        const records = Array.from(current[LISTENERS_SYM].get(event.type))
        for (const record of records) {
          if (record.once) {
            current[LISTENERS_SYM].get(event.type).delete(record)
          }
          try {
            if (typeof record.listener === 'function') {
              record.listener.call(current, event)
            } else if (typeof record.listener?.handleEvent === 'function') {
              record.listener.handleEvent(event)
            }
          } catch (err) {
            console.error('Unhandled listener error during dispatchEvent:', err)
          }
          if (stopImmediatePropagationFlag) {
            break
          }
        }
      }

      if (stopPropagationFlag || !event.bubbles) {
        break
      }

      current = current.parent || current.parentNode || null
    }

    return !event.defaultPrevented
  }
}

Object.defineProperties(CoraliteNodePrototype, {
  nodeType: {
    get () {
      return nodeTypes[this.type] || ELEMENT_NODE
    }
  },
  parent: {
    get () {
      return this[PARENT_SYM] || null
    },
    set (v) {
      this[PARENT_SYM] = v
    },
    enumerable: false
  },
  prev: {
    get () {
      return this[PREV_SYM] || null
    },
    set (v) {
      this[PREV_SYM] = v
    },
    enumerable: false
  },
  next: {
    get () {
      return this[NEXT_SYM] || null
    },
    set (v) {
      this[NEXT_SYM] = v
    },
    enumerable: false
  },
  slots: {
    get () {
      return this[SLOTS_SYM] || null
    },
    set (v) {
      this[SLOTS_SYM] = v
    },
    enumerable: false
  },
  parentNode: {
    get () {
      return this.parent || null
    },
    set (value) {
      this.parent = value
    }
  },
  parentElement: {
    get () {
      return this.parent || null
    },
    set (value) {
      this.parent = value
    }
  },
  previousSibling: {
    get () {
      return this.prev || null
    }
  },
  nextSibling: {
    get () {
      return this.next || null
    }
  }
})

/**
 * Prototype for Coralite Elements.
 */
const CoraliteElementPrototype = Object.create(CoraliteNodePrototype)

/**
 * Returns the value of a specified attribute on the element.
 * @param {string} name - The name of the attribute
 * @returns {string | null}
 */
CoraliteElementPrototype.getAttribute = function (name) {
  return this.attribs && Object.hasOwn(this.attribs, name) ? this.attribs[name] : null
}

/**
 * Sets the value of an attribute on the element.
 * @param {string} name - The name of the attribute
 * @param {any} value - The value to set
 */
CoraliteElementPrototype.setAttribute = function (name, value) {
  if (!this.attribs) {
    this.attribs = {}
  }
  this.attribs[name] = String(value)
}

/**
 * Returns a boolean value indicating whether the specified element has the specified attribute or not.
 * @param {string} name - The name of the attribute
 * @returns {boolean}
 */
CoraliteElementPrototype.hasAttribute = function (name) {
  return !!(this.attribs && Object.hasOwn(this.attribs, name))
}

/**
 * Removes an attribute from the element.
 * @param {string} name - The name of the attribute
 */
CoraliteElementPrototype.removeAttribute = function (name) {
  if (this.attribs) {
    delete this.attribs[name]
  }
}

/**
 * Adds a node to the end of the list of children of a specified parent node.
 * @param {any} node - The node to append
 * @returns {any}
 */
CoraliteElementPrototype.appendChild = function (node) {
  if (node.parent) {
    node.remove()
  }

  if (!this.children) {
    this.children = []
  }

  const lastChild = this.children[this.children.length - 1]
  if (lastChild) {
    lastChild.next = node
    node.prev = lastChild
  } else {
    node.prev = null
  }

  node.next = null
  node.parent = this
  this.children.push(node)

  return node
}

/**
 * Inserts a set of Node objects or string objects after the last child of the Element.
 * @param {...(any)} nodes - The nodes or strings to append
 */
CoraliteElementPrototype.append = function (...nodes) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    }
    this.appendChild(node)
  }
}

/**
 * Inserts a set of Node objects or string objects at the beginning of the children of the Element.
 * @param {...any} nodes - Nodes or strings to prepend
 */
CoraliteElementPrototype.prepend = function (...nodes) {
  if (!this.children) {
    this.children = []
  }
  const preparedNodes = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    } else if (node.parent) {
      node.remove()
    }
    preparedNodes.push(node)
  }
  this.children.unshift(...preparedNodes)
  relinkChildren(this)
}

/**
 * Replaces all children of the element with specified nodes or strings.
 * @param {...any} nodes - Replacement nodes or strings
 */
CoraliteElementPrototype.replaceChildren = function (...nodes) {
  // @ts-ignore
  const currentChildren = this.childNodes || this.children
  if (currentChildren) {
    for (let i = 0; i < currentChildren.length; i++) {
      const child = currentChildren[i]
      child.parent = null
      child.prev = null
      child.next = null
    }
  }
  this.children = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    }
    // @ts-ignore
    this.appendChild(node)
  }
}

/**
 * Replaces the element in its parent with the specified nodes or strings.
 * @param {...any} nodes - Replacement nodes or strings
 */
CoraliteElementPrototype.replaceWith = function (...nodes) {
  if (!this.parent || !this.parent.children) {
    return
  }
  const parent = this.parent
  const index = parent.children.indexOf(this)
  if (index === -1) {
    return
  }

  this.remove()

  const preparedNodes = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    } else if (node.parent) {
      node.remove()
    }
    preparedNodes.push(node)
  }

  parent.children.splice(index, 0, ...preparedNodes)
  relinkChildren(parent)
}

/**
 * Inserts nodes or strings immediately before the element.
 * @param {...any} nodes - Nodes or strings to insert before
 */
CoraliteElementPrototype.before = function (...nodes) {
  if (!this.parent || !this.parent.children) {
    return
  }
  const parent = this.parent
  const index = parent.children.indexOf(this)
  if (index === -1) {
    return
  }

  const preparedNodes = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    } else if (node.parent) {
      node.remove()
    }
    preparedNodes.push(node)
  }

  parent.children.splice(index, 0, ...preparedNodes)
  relinkChildren(parent)
}

/**
 * Inserts nodes or strings immediately after the element.
 * @param {...any} nodes - Nodes or strings to insert after
 */
CoraliteElementPrototype.after = function (...nodes) {
  if (!this.parent || !this.parent.children) {
    return
  }
  const parent = this.parent
  const index = parent.children.indexOf(this)
  if (index === -1) {
    return
  }

  const preparedNodes = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    } else if (node.parent) {
      node.remove()
    }
    preparedNodes.push(node)
  }

  parent.children.splice(index + 1, 0, ...preparedNodes)
  relinkChildren(parent)
}

/**
 * Checks if another node is a descendant of this node.
 * @param {any} otherNode - Target node to check
 * @returns {boolean}
 */
CoraliteElementPrototype.contains = function (otherNode) {
  let curr = otherNode
  while (curr) {
    if (curr === this) {
      return true
    }
    curr = curr.parent
  }
  return false
}

/**
 * Creates a clone of the node.
 * @param {boolean} [deep=false] - Deep clone flag
 * @returns {CoraliteElement}
 */
CoraliteElementPrototype.cloneNode = function (deep = false) {
  const clonedAttribs = this.attribs ? { ...this.attribs } : {}
  const cloned = createCoraliteElement({
    type: this.type || 'tag',
    name: this.name,
    attribs: clonedAttribs,
    children: []
  })

  if (deep && this.children) {
    cloned.children = this.children.map(child => {
      if (typeof child.cloneNode === 'function') {
        return child.cloneNode(true)
      }
      return createCoraliteTextNode({
        type: 'text',
        data: child.data || ''
      })
    })
    relinkChildren(cloned)
  }

  return cloned
}

/**
 * Returns bounding client rectangle dimensions.
 * @returns {{x: number, y: number, top: number, bottom: number, left: number, right: number, width: number, height: number, toJSON: Function}}
 */
CoraliteElementPrototype.getBoundingClientRect = function () {
  const width = this.offsetWidth || 0
  const height = this.offsetHeight || 0
  return {
    x: 0,
    y: 0,
    top: 0,
    bottom: height,
    left: 0,
    right: width,
    width,
    height,
    toJSON () {
      return {
        x: this.x,
        y: this.y,
        top: this.top,
        bottom: this.bottom,
        left: this.left,
        right: this.right,
        width: this.width,
        height: this.height
      }
    }
  }
}

/**
 * Returns array of client rectangles.
 * @returns {Array<{x: number, y: number, top: number, bottom: number, left: number, right: number, width: number, height: number, toJSON: Function}>}
 */
CoraliteElementPrototype.getClientRects = function () {
  return [this.getBoundingClientRect()]
}

CoraliteElementPrototype.scrollIntoView = function () {
}
CoraliteElementPrototype.scrollTo = function () {
}
CoraliteElementPrototype.scrollBy = function () {
}
CoraliteElementPrototype.focus = function () {
}
CoraliteElementPrototype.blur = function () {
}

/**
 * Helper to match an element against a parsed selector piece.
 * @param {CoraliteElement} el - Element to match
 * @param {string} sel - Selector string
 * @returns {boolean}
 */
function matchSingleSelector (el, sel) {
  if (!el || el.type !== 'tag') {
    return false
  }
  sel = sel.trim()
  if (!sel || sel === '*') {
    return true
  }

  // Handle pseudo-class :not(...)
  if (sel.startsWith(':not(') && sel.endsWith(')')) {
    const inner = sel.slice(5, -1).trim()
    return !matchSingleSelector(el, inner)
  }

  // Parse compound selector like `h2.title#main[attr=val]`
  // Tokenize regex matching tags, .class, #id, [attr...]
  const tokens = sel.match(/([a-zA-Z0-9_\-*]+)|(\.[a-zA-Z0-9_\-]+)|(#[a-zA-Z0-9_\-]+)|(\[[^\]]+\])/g)
  if (!tokens || tokens.length === 0) {
    return false
  }

  for (const token of tokens) {
    if (token.startsWith('.')) {
      const className = token.slice(1)
      // @ts-ignore
      if (!el.classList || !el.classList.contains(className)) {
        return false
      }
    } else if (token.startsWith('#')) {
      const id = token.slice(1)
      if (el.id !== id) {
        return false
      }
    } else if (token.startsWith('[')) {
      const attrExpr = token.slice(1, -1).trim()
      if (!attrExpr) {
        continue
      }
      if (attrExpr.includes('^=')) {
        const [attr, val] = attrExpr.split('^=').map(s => s.trim().replace(/^["']|["']$/g, ''))
        const actual = el.getAttribute(attr)
        if (!actual || !actual.startsWith(val)) {
          return false
        }
      } else if (attrExpr.includes('$=')) {
        const [attr, val] = attrExpr.split('$=').map(s => s.trim().replace(/^["']|["']$/g, ''))
        const actual = el.getAttribute(attr)
        if (!actual || !actual.endsWith(val)) {
          return false
        }
      } else if (attrExpr.includes('*=')) {
        const [attr, val] = attrExpr.split('*=').map(s => s.trim().replace(/^["']|["']$/g, ''))
        const actual = el.getAttribute(attr)
        if (!actual || !actual.includes(val)) {
          return false
        }
      } else if (attrExpr.includes('=')) {
        const [attr, val] = attrExpr.split('=').map(s => s.trim().replace(/^["']|["']$/g, ''))
        const actual = el.getAttribute(attr)
        if (actual !== val) {
          return false
        }
      } else {
        if (!el.hasAttribute(attrExpr)) {
          return false
        }
      }
    } else {
      // Tag name match
      if (token !== '*' && (el.name || '').toLowerCase() !== token.toLowerCase()) {
        return false
      }
    }
  }

  return true
}

/**
 * Tests if element matches a selector chain (e.g. `.container .child`).
 * @param {CoraliteElement} el - Element to match
 * @param {string} selector - CSS selector
 * @returns {boolean}
 */
function elementMatches (el, selector) {
  if (!el || el.type !== 'tag') {
    return false
  }
  const selectorLists = selector.split(',').map(s => s.trim()).filter(Boolean)

  for (const selList of selectorLists) {
    // Split space-separated descendant selectors
    const parts = selList.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      if (matchSingleSelector(el, parts[0])) {
        return true
      }
    } else {
      // Match from right to left (descendant to ancestor)
      let currentEl = el
      let partIdx = parts.length - 1
      let matched = true

      while (partIdx >= 0) {
        const targetPart = parts[partIdx]
        if (partIdx === parts.length - 1) {
          if (!matchSingleSelector(currentEl, targetPart)) {
            matched = false
            break
          }
          partIdx--
        } else {
          // Find an ancestor that matches targetPart
          let ancestor = currentEl.parent
          let foundAncestor = false
          while (ancestor && ancestor.type === 'tag') {
            if (matchSingleSelector(ancestor, targetPart)) {
              foundAncestor = true
              currentEl = ancestor
              break
            }
            ancestor = ancestor.parent
          }
          if (!foundAncestor) {
            matched = false
            break
          }
          partIdx--
        }
      }

      if (matched) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks if element matches the specified selector.
 * @param {string} selector - CSS selector
 * @returns {boolean}
 */
CoraliteElementPrototype.matches = function (selector) {
  return elementMatches(this, selector)
}

/**
 * Returns the closest ancestor (or self) matching the selector.
 * @param {string} selector - CSS selector
 * @returns {CoraliteElement|null}
 */
CoraliteElementPrototype.closest = function (selector) {
  let curr = this
  while (curr && curr.type === 'tag') {
    if (curr.matches(selector)) {
      return curr
    }
    curr = curr.parent
  }
  return null
}

/**
 * Finds first descendant matching selector.
 * @param {string} selector - CSS selector
 * @returns {CoraliteElement|null}
 */
CoraliteElementPrototype.querySelector = function (selector) {
  let result = null
  function walk (node) {
    if (result || !node.children) {
      return
    }
    for (const child of node.children) {
      if (child.type === 'tag') {
        if (child.matches(selector)) {
          result = child
          return
        }
        walk(child)
        if (result) {
          return
        }
      }
    }
  }
  walk(this)
  return result
}

/**
 * Finds all descendants matching selector.
 * @param {string} selector - CSS selector
 * @returns {CoraliteElement[]}
 */
CoraliteElementPrototype.querySelectorAll = function (selector) {
  const results = []
  function walk (node) {
    if (!node.children) {
      return
    }
    for (const child of node.children) {
      if (child.type === 'tag') {
        if (child.matches(selector)) {
          results.push(child)
        }
        walk(child)
      }
    }
  }
  walk(this)
  return results
}

/**
 * Finds element by ID.
 * @param {string} id - Element ID
 * @returns {CoraliteElement|null}
 */
CoraliteElementPrototype.getElementById = function (id) {
  return this.querySelector(`#${id}`)
}

/**
 * Finds elements by tag name.
 * @param {string} tag - Tag name
 * @returns {CoraliteElement[]}
 */
CoraliteElementPrototype.getElementsByTagName = function (tag) {
  return this.querySelectorAll(tag)
}

/**
 * Finds elements by class name.
 * @param {string} cls - Class name
 * @returns {CoraliteElement[]}
 */
CoraliteElementPrototype.getElementsByClassName = function (cls) {
  const selector = cls.split(/\s+/).filter(Boolean).map(c => `.${c}`).join('')
  return this.querySelectorAll(selector)
}

Object.defineProperties(CoraliteElementPrototype, {
  nodeName: {
    get () {
      return (this.name || '').toUpperCase()
    }
  },
  tagName: {
    get () {
      return (this.name || '').toUpperCase()
    },
    set (value) {
      this.name = (value || '').toLowerCase()
    }
  },
  nodeValue: {
    get () {
      return null
    },
    set () {
      // Elements do not have nodeValue
    }
  },
  attributes: {
    get () {
      return this.attribs
    },
    set (value) {
      this.attribs = value
    }
  },
  childNodes: {
    get () {
      return this.children || []
    },
    set (value) {
      this.children = value
    }
  },
  firstChild: {
    get () {
      return (this.children && this.children[0]) || null
    }
  },
  lastChild: {
    get () {
      return (this.children && this.children[this.children.length - 1]) || null
    }
  },
  childElementCount: {
    get () {
      return (this.children || []).filter(child => child && child.nodeType === ELEMENT_NODE).length
    }
  },
  firstElementChild: {
    get () {
      return (this.children || []).find(child => child && child.nodeType === ELEMENT_NODE) || null
    }
  },
  lastElementChild: {
    get () {
      const kids = (this.children || []).filter(child => child && child.nodeType === ELEMENT_NODE)
      return kids[kids.length - 1] || null
    }
  },
  nextElementSibling: {
    get () {
      let curr = this.next
      while (curr) {
        if (curr.nodeType === ELEMENT_NODE) {
          return curr
        }
        curr = curr.next
      }
      return null
    }
  },
  previousElementSibling: {
    get () {
      let curr = this.prev
      while (curr) {
        if (curr.nodeType === ELEMENT_NODE) {
          return curr
        }
        curr = curr.prev
      }
      return null
    }
  },
  offsetWidth: {
    get () {
      if (this.attribs?.width && !isNaN(Number(this.attribs.width))) {
        return Number(this.attribs.width)
      }
      return parseDimension(this.attribs?.style, 'width') || 0
    }
  },
  offsetHeight: {
    get () {
      if (this.attribs?.height && !isNaN(Number(this.attribs.height))) {
        return Number(this.attribs.height)
      }
      return parseDimension(this.attribs?.style, 'height') || 0
    }
  },
  clientWidth: {
    get () {
      return this.offsetWidth
    }
  },
  clientHeight: {
    get () {
      return this.offsetHeight
    }
  },
  scrollWidth: {
    get () {
      return this.offsetWidth
    }
  },
  scrollHeight: {
    get () {
      return this.offsetHeight
    }
  },
  clientTop: {
    get () {
      return 0
    }
  },
  clientLeft: {
    get () {
      return 0
    }
  },
  offsetTop: {
    get () {
      return 0
    }
  },
  offsetLeft: {
    get () {
      return 0
    }
  },
  scrollTop: {
    get () {
      return 0
    },
    set () {
    }
  },
  scrollLeft: {
    get () {
      return 0
    },
    set () {
    }
  },
  offsetParent: {
    get () {
      return this.parentElement || null
    }
  },
  textContent: {
    get () {
      if (this.children) {
        return this.children.map(child => child.textContent).join('')
      }
      return ''
    },
    set (value) {
      if (this.children) {
        for (const child of this.children) {
          child.parent = null
          child.prev = null
          child.next = null
        }
      }

      const textNode = createCoraliteTextNode({
        type: 'text',
        data: value,
        parent: this,
        prev: null,
        next: null
      })
      this.children = [textNode]
    }
  },
  innerHTML: {
    get () {
      return render(this.children || [])
    },
    set (value) {
      if (this.children) {
        for (const child of this.children) {
          child.parent = null
          child.prev = null
          child.next = null
        }
      }
      const parsed = parseHTML(String(value ?? ''))
      this.children = parsed.root.children || []
      relinkChildren(this)
    }
  },
  outerHTML: {
    get () {
      return render(this)
    },
    set (value) {
      if (!this.parent || !this.parent.children) {
        return
      }
      const parent = this.parent
      const index = parent.children.indexOf(this)
      if (index === -1) {
        return
      }

      this.remove()
      const parsed = parseHTML(String(value ?? ''))
      const newNodes = parsed.root.children || []
      parent.children.splice(index, 0, ...newNodes)
      relinkChildren(parent)
    }
  },
  dataset: {
    get () {
      if (!this[DATASET_PROXY_SYM]) {
        const self = this
        this[DATASET_PROXY_SYM] = new Proxy({}, {
          get (_, prop) {
            if (typeof prop !== 'string') {
              return undefined
            }
            const kebab = `data-${camelToKebab(prop)}`
            return self.getAttribute(kebab) ?? undefined
          },
          set (_, prop, value) {
            if (typeof prop !== 'string') {
              return false
            }
            const kebab = `data-${camelToKebab(prop)}`
            self.setAttribute(kebab, value)
            return true
          },
          deleteProperty (_, prop) {
            if (typeof prop !== 'string') {
              return false
            }
            const kebab = `data-${camelToKebab(prop)}`
            self.removeAttribute(kebab)
            return true
          },
          has (_, prop) {
            if (typeof prop !== 'string') {
              return false
            }
            const kebab = `data-${camelToKebab(prop)}`
            return self.hasAttribute(kebab)
          },
          ownKeys () {
            const keys = []
            if (self.attribs) {
              for (const attr in self.attribs) {
                if (attr.startsWith('data-')) {
                  keys.push(kebabToCamel(attr.slice(5)))
                }
              }
            }
            return keys
          },
          getOwnPropertyDescriptor (_, prop) {
            if (typeof prop !== 'string') {
              return undefined
            }
            const kebab = `data-${camelToKebab(prop)}`
            if (self.hasAttribute(kebab)) {
              return {
                configurable: true,
                enumerable: true,
                writable: true,
                value: self.getAttribute(kebab)
              }
            }
            return undefined
          }
        })
      }
      return this[DATASET_PROXY_SYM]
    }
  },
  style: {
    get () {
      if (!this[STYLE_PROXY_SYM]) {
        const self = this
        const baseStyle = {
          setProperty (name, value) {
            const kebab = camelToKebab(name).toLowerCase()
            const styleMap = parseStyleString(self.attribs?.style)
            if (value === null || value === undefined || value === '') {
              delete styleMap[kebab]
            } else {
              styleMap[kebab] = String(value)
            }
            const serialized = serializeStyleMap(styleMap)
            if (serialized) {
              self.setAttribute('style', serialized)
            } else {
              self.removeAttribute('style')
            }
          },
          getPropertyValue (name) {
            const kebab = camelToKebab(name).toLowerCase()
            const styleMap = parseStyleString(self.attribs?.style)
            return styleMap[kebab] || ''
          },
          removeProperty (name) {
            const kebab = camelToKebab(name).toLowerCase()
            const styleMap = parseStyleString(self.attribs?.style)
            const oldVal = styleMap[kebab] || ''
            delete styleMap[kebab]
            const serialized = serializeStyleMap(styleMap)
            if (serialized) {
              self.setAttribute('style', serialized)
            } else {
              self.removeAttribute('style')
            }
            return oldVal
          }
        }

        Object.defineProperty(baseStyle, 'cssText', {
          get () {
            return self.getAttribute('style') || ''
          },
          set (value) {
            if (value === null || value === undefined || value === '') {
              self.removeAttribute('style')
            } else {
              self.setAttribute('style', String(value))
            }
          },
          enumerable: true,
          configurable: true
        })

        this[STYLE_PROXY_SYM] = new Proxy(baseStyle, {
          get (target, prop) {
            if (typeof prop !== 'string') {
              return target[prop]
            }
            if (prop in target) {
              return target[prop]
            }
            const kebab = camelToKebab(prop).toLowerCase()
            const styleMap = parseStyleString(self.attribs?.style)
            return styleMap[kebab] || ''
          },
          set (target, prop, value) {
            if (typeof prop !== 'string') {
              return false
            }
            if (prop === 'cssText') {
              target.cssText = value
              return true
            }
            target.setProperty(prop, value)
            return true
          },
          deleteProperty (_, prop) {
            if (typeof prop !== 'string') {
              return false
            }
            const kebab = camelToKebab(prop).toLowerCase()
            const styleMap = parseStyleString(self.attribs?.style)
            delete styleMap[kebab]
            const serialized = serializeStyleMap(styleMap)
            if (serialized) {
              self.setAttribute('style', serialized)
            } else {
              self.removeAttribute('style')
            }
            return true
          }
        })
      }
      return this[STYLE_PROXY_SYM]
    },
    set (value) {
      if (typeof value === 'string') {
        this.setAttribute('style', value)
      } else if (value === null || value === undefined) {
        this.removeAttribute('style')
      }
    }
  },
  value: {
    get () {
      if (this.name === 'textarea') {
        return this.textContent
      }
      return this.getAttribute('value') || ''
    },
    set (val) {
      if (this.name === 'textarea') {
        this.textContent = String(val ?? '')
      } else {
        this.setAttribute('value', String(val ?? ''))
      }
    }
  },
  checked: {
    get () {
      return this.hasAttribute('checked')
    },
    set (val) {
      if (val) {
        this.setAttribute('checked', '')
      } else {
        this.removeAttribute('checked')
      }
    }
  },
  disabled: {
    get () {
      return this.hasAttribute('disabled')
    },
    set (val) {
      if (val) {
        this.setAttribute('disabled', '')
      } else {
        this.removeAttribute('disabled')
      }
    }
  },
  id: {
    get () {
      return this.attribs ? this.attribs.id : ''
    },
    set (value) {
      if (!this.attribs) {
        this.attribs = {}
      }
      this.attribs.id = value
    }
  },
  className: {
    get () {
      return this.attribs ? this.attribs.class : ''
    },
    set (value) {
      if (!this.attribs) {
        this.attribs = {}
      }
      this.attribs.class = value
    }
  },
  classList: {
    get () {
      if (!this._classList) {
        const self = this
        const classList = {
          add (...classes) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            const set = new Set(current)
            classes.forEach(c => set.add(c))
            self.className = Array.from(set).join(' ')
          },
          remove (...classes) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            const set = new Set(current)
            classes.forEach(c => set.delete(c))
            self.className = Array.from(set).join(' ')
          },
          contains (cls) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            return current.includes(cls)
          },
          toggle (cls, force) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            const set = new Set(current)
            if (force !== undefined) {
              if (force) {
                set.add(cls)
              } else {
                set.delete(cls)
              }
            } else {
              if (set.has(cls)) {
                set.delete(cls)
              } else {
                set.add(cls)
              }
            }
            self.className = Array.from(set).join(' ')
            return set.has(cls)
          },
          get value () {
            return self.className
          }
        }
        Object.defineProperty(this, '_classList', {
          value: classList,
          enumerable: false,
          writable: true,
          configurable: true
        })
      }
      return this._classList
    }
  }
})

/**
 * Prototype for Coralite Text Nodes.
 */
const CoraliteTextNodePrototype = Object.create(CoraliteNodePrototype)

Object.defineProperties(CoraliteTextNodePrototype, {
  nodeName: {
    get () {
      return '#text'
    }
  },
  nodeValue: {
    get () {
      return this.data
    },
    set (value) {
      this.data = value
    }
  },
  textContent: {
    get () {
      return this.data
    },
    set (value) {
      this.data = value
    }
  }
})

CoraliteTextNodePrototype.cloneNode = function (_deep = false) {
  return createCoraliteTextNode({
    type: 'text',
    data: this.data || ''
  })
}

/**
 * Prototype for Coralite Comment Nodes.
 */
const CoraliteCommentPrototype = Object.create(CoraliteNodePrototype)

Object.defineProperties(CoraliteCommentPrototype, {
  nodeName: {
    get () {
      return '#comment'
    }
  },
  nodeValue: {
    get () {
      return this.data
    },
    set (value) {
      this.data = value
    }
  },
  textContent: {
    get () {
      return this.data
    },
    set (value) {
      this.data = value
    }
  }
})

CoraliteCommentPrototype.cloneNode = function (_deep = false) {
  return createCoraliteComment({
    type: 'comment',
    data: this.data || ''
  })
}

/**
 * Prototype for Coralite Directive Nodes.
 */
const CoraliteDirectivePrototype = Object.create(CoraliteNodePrototype)

Object.defineProperties(CoraliteDirectivePrototype, {
  nodeName: {
    get () {
      return this.name
    }
  },
  nodeValue: {
    get () {
      return this.data
    },
    set (value) {
      this.data = value
    }
  }
})

/**
 * Prototype for Coralite Component Roots (Document).
 */
const CoraliteComponentPrototype = Object.create(CoraliteNodePrototype)

CoraliteComponentPrototype.querySelector = CoraliteElementPrototype.querySelector
CoraliteComponentPrototype.querySelectorAll = CoraliteElementPrototype.querySelectorAll
CoraliteComponentPrototype.getElementById = CoraliteElementPrototype.getElementById
CoraliteComponentPrototype.getElementsByTagName = CoraliteElementPrototype.getElementsByTagName
CoraliteComponentPrototype.getElementsByClassName = CoraliteElementPrototype.getElementsByClassName

Object.defineProperties(CoraliteComponentPrototype, {
  nodeName: {
    get () {
      return '#document'
    }
  },
  nodeValue: {
    get () {
      return null
    }
  },
  childNodes: {
    get () {
      return this.children || []
    },
    set (value) {
      this.children = value
    }
  },
  firstChild: {
    get () {
      return (this.children && this.children[0]) || null
    }
  },
  lastChild: {
    get () {
      return (this.children && this.children[this.children.length - 1]) || null
    }
  },
  textContent: {
    get () {
      return null
    }
  }
})

/**
 * Internal helper to get prototype based on node type.
 */
function getPrototypeForType (type) {
  switch (type) {
    case 'tag':
    case 'script':
    case 'style':
      return CoraliteElementPrototype
    case 'text':
      return CoraliteTextNodePrototype
    case 'comment':
      return CoraliteCommentPrototype
    case 'directive':
      return CoraliteDirectivePrototype
    case 'root':
      return CoraliteComponentPrototype
    default:
      return CoraliteNodePrototype
  }
}

/**
 * Enhances a raw node by applying the correct prototype based on its type.
 * @param {any} node - The node to enhance
 * @returns {any} The enhanced node
 */
export function enhanceNode (node) {
  if (!node || typeof node !== 'object' || node.__coralite_enhanced__) {
    return node
  }

  const prototype = getPrototypeForType(node.type)
  Object.setPrototypeOf(node, prototype)
  makeCircularPropertiesNonEnumerable(node)

  Object.defineProperty(node, '__coralite_enhanced__', {
    value: true,
    enumerable: false,
    configurable: true
  })

  return node
}

/**
 * Re-links all children of a parent node, ensuring parent, prev, and next pointers are correct.
 * @param {any} parent - The parent node whose children should be re-linked
 */
export function relinkChildren (parent) {
  if (!parent || !parent.children || !Array.isArray(parent.children)) {
    return
  }

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (!child || typeof child !== 'object') {
      continue
    }

    enhanceNode(child)
    child.parent = parent
    child.prev = parent.children[i - 1] || null
    child.next = parent.children[i + 1] || null

    if (child.children) {
      relinkChildren(child)
    }
  }
}

/**
 * Creates an enhanced Coralite Element
 * @param {RawCoraliteElement} node - The raw element node
 * @returns {CoraliteElement} The enhanced Coralite Element
 */
export function createCoraliteElement (node) {
  node.type = node.type || 'tag'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Text Node
 * @param {RawCoraliteTextNode} node - The raw text node
 * @returns {CoraliteTextNode} The enhanced Coralite Text Node
 */
export function createCoraliteTextNode (node) {
  node.type = 'text'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Comment Node
 * @param {RawCoraliteComment} node - The raw comment node
 * @returns {CoraliteComment} The enhanced Coralite Comment Node
 */
export function createCoraliteComment (node) {
  node.type = 'comment'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Directive Node (e.g. DOCTYPE)
 * @param {RawCoraliteDirective} node - The raw directive node
 * @returns {CoraliteDirective} The enhanced Coralite Directive Node
 */
export function createCoraliteDirective (node) {
  node.type = 'directive'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Document Root
 * @param {RawCoraliteComponentRoot} node - The raw document node
 * @returns {CoraliteComponentRoot} The enhanced Coralite Document Root
 */
export function createCoraliteComponent (node) {
  node.type = 'root'
  return enhanceNode(node)
}
