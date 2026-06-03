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
 * } from '../types/index.js'
 */

import { transformNode } from './parser.js'

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

/**
 * Ensures circular properties are non-enumerable to prevent serialization issues.
 * @param {any} node - The node to enhance
 */
function makeCircularPropertiesNonEnumerable (node) {
  for (const key of ['parent', 'prev', 'next', 'slots']) {
    if (Object.hasOwn(node, key)) {
      Object.defineProperty(node, key, {
        enumerable: false,
        writable: true,
        configurable: true
      })
    }
  }
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
   * Checks if this node contains another node.
   * @param {any} otherNode - The node to check
   * @returns {boolean}
   */
  contains (otherNode) {
    if (otherNode === this) {
      return true
    }
    let node = otherNode.parent
    while (node) {
      if (node === this) {
        return true
      }
      node = node.parent
    }
    return false
  }
}

Object.defineProperties(CoraliteNodePrototype, {
  nodeType: {
    get () {
      return nodeTypes[this.type] || ELEMENT_NODE
    }
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
 * Enhances a raw node by applying the correct prototype based on its type.
 * @param {any} node - The node to enhance
 * @returns {any} The enhanced node
 */
export function enhanceNode (node) {
  if (!node || node.__coralite_enhanced__) {
    return node
  }

  makeCircularPropertiesNonEnumerable(node)

  let prototype
  switch (node.type) {
    case 'tag':
    case 'script':
    case 'style':
      prototype = CoraliteElementPrototype
      break
    case 'text':
      prototype = CoraliteTextNodePrototype
      break
    case 'comment':
      prototype = CoraliteCommentPrototype
      break
    case 'directive':
      prototype = CoraliteDirectivePrototype
      break
    case 'root':
      prototype = CoraliteComponentPrototype
      break
    default:
      prototype = CoraliteNodePrototype
  }

  Object.setPrototypeOf(node, prototype)
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
    if (!child) {
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

const ManipulationMethods = {
  /**
   * Adds a node to the end of the list of children of a specified parent node.
   * @this {any}
   * @param {any} node - The node to append
   * @returns {any}
   */
  appendChild (node) {
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

    enhanceNode(node)

    return node
  },

  /**
   * Inserts a set of Node objects or string objects after the last child of the Element.
   * @this {any}
   * @param {...(any)} nodes - The nodes or strings to append
   */
  append (...nodes) {
    for (let node of nodes) {
      if (typeof node === 'string') {
        node = createCoraliteTextNode({
          type: 'text',
          data: node
        })
      }
      this.appendChild(node)
    }
  },

  /**
   * Inserts a set of Node objects or string objects before the first child of the Element.
   * @this {any}
   * @param {...(any)} nodes - The nodes or strings to prepend
   */
  prepend (...nodes) {
    if (!this.children) {
      this.children = []
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      let node = nodes[i]
      if (typeof node === 'string') {
        node = createCoraliteTextNode({
          type: 'text',
          data: node
        })
      }
      if (node.parent) {
        node.remove()
      }

      const firstChild = this.children[0]
      if (firstChild) {
        firstChild.prev = node
        node.next = firstChild
      } else {
        node.next = null
      }

      node.prev = null
      node.parent = this
      this.children.unshift(node)
      enhanceNode(node)
    }
  },

  /**
   * Inserts a node before a reference node as a child of a specified parent node.
   * @this {any}
   * @param {any} newNode - The node to insert
   * @param {any} referenceNode - The node before which newNode is inserted
   * @returns {any}
   */
  insertBefore (newNode, referenceNode) {
    if (!this.children) {
      this.children = []
    }

    if (!referenceNode) {
      return this.appendChild(newNode)
    }

    const index = this.children.indexOf(referenceNode)
    if (index === -1) {
      throw new Error('Reference node is not a child of this node')
    }

    if (newNode.parent) {
      newNode.remove()
    }

    newNode.parent = this
    newNode.prev = referenceNode.prev
    newNode.next = referenceNode

    if (referenceNode.prev) {
      referenceNode.prev.next = newNode
    }
    referenceNode.prev = newNode

    this.children.splice(index, 0, newNode)
    enhanceNode(newNode)

    return newNode
  },

  /**
   * Replaces one child node of the specified node with another.
   * @this {any}
   * @param {any} newNode - The new node to replace oldNode
   * @param {any} oldNode - The node to be replaced
   * @returns {any}
   */
  replaceChild (newNode, oldNode) {
    if (!this.children) {
      throw new Error('Node has no children')
    }

    const index = this.children.indexOf(oldNode)
    if (index === -1) {
      throw new Error('Old node is not a child of this node')
    }

    if (newNode.parent) {
      newNode.remove()
    }

    newNode.parent = this
    newNode.prev = oldNode.prev
    newNode.next = oldNode.next

    if (oldNode.prev) {
      oldNode.prev.next = newNode
    }
    if (oldNode.next) {
      oldNode.next.prev = newNode
    }

    this.children.splice(index, 1, newNode)

    oldNode.parent = null
    oldNode.prev = null
    oldNode.next = null

    enhanceNode(newNode)

    return oldNode
  }
}

/**
 * Prototype for Coralite Elements.
 */
const CoraliteElementPrototype = Object.assign(Object.create(CoraliteNodePrototype), ManipulationMethods)

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
 * Returns an array containing the names of the attributes of the current element.
 * @returns {string[]}
 */
CoraliteElementPrototype.getAttributeNames = function () {
  return this.attribs ? Object.keys(this.attribs) : []
}

/**
 * Returns a boolean value indicating whether the specified element has any attributes or not.
 * @returns {boolean}
 */
CoraliteElementPrototype.hasAttributes = function () {
  return this.attribs && Object.keys(this.attribs).length > 0
}

Object.defineProperties(CoraliteElementPrototype, {
  nodeName: {
    get () {
      return this.name.toUpperCase()
    }
  },
  tagName: {
    get () {
      return this.name.toUpperCase()
    },
    set (value) {
      this.name = value.toLowerCase()
    }
  },
  nodeValue: {
    get () {
      return null
    },
    set (value) {
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
  firstElementChild: {
    get () {
      return (this.children || []).find(child => child.type === 'tag' || child.type === 'script' || child.type === 'style') || null
    }
  },
  lastElementChild: {
    get () {
      const elements = (this.children || []).filter(child => child.type === 'tag' || child.type === 'script' || child.type === 'style')
      return elements[elements.length - 1] || null
    }
  },
  nextElementSibling: {
    get () {
      let next = this.next
      while (next) {
        if (next.type === 'tag' || next.type === 'script' || next.type === 'style') {
          return next
        }
        next = next.next
      }
      return null
    }
  },
  previousElementSibling: {
    get () {
      let prev = this.prev
      while (prev) {
        if (prev.type === 'tag' || prev.type === 'script' || prev.type === 'style') {
          return prev
        }
        prev = prev.prev
      }
      return null
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
        data: String(value)
      })
      textNode.parent = this
      this.children = [textNode]
    }
  },
  innerHTML: {
    get () {
      return transformNode(this.children)
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
  dataset: {
    get () {
      if (!this._dataset) {
        const self = this
        this._dataset = new Proxy({}, {
          get (target, prop) {
            if (typeof prop !== 'string') {
              return undefined
            }
            const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            return self.getAttribute(attrName)
          },
          set (target, prop, value) {
            if (typeof prop !== 'string') {
              return false
            }
            const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            self.setAttribute(attrName, value)
            return true
          },
          deleteProperty (target, prop) {
            if (typeof prop !== 'string') {
              return false
            }
            const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            self.removeAttribute(attrName)
            return true
          },
          ownKeys (target) {
            return self.getAttributeNames()
              .filter(name => name.startsWith('data-'))
              .map(name => name.slice(5).replace(/-([a-z])/g, (g) => g[1].toUpperCase()))
          },
          getOwnPropertyDescriptor (target, prop) {
            return {
              enumerable: true,
              configurable: true
            }
          }
        })
      }
      return this._dataset
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
          replace (oldClass, newClass) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            const index = current.indexOf(oldClass)
            if (index !== -1) {
              current[index] = newClass
              self.className = current.join(' ')
              return true
            }
            return false
          },
          item (index) {
            const current = self.className ? self.className.split(/\s+/).filter(Boolean) : []
            return current[index] || null
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
const CoraliteComponentPrototype = Object.assign(Object.create(CoraliteNodePrototype), ManipulationMethods)

CoraliteComponentPrototype.createElement = function (tagName) {
  return createCoraliteElement({
    type: 'tag',
    name: tagName.toLowerCase(),
    children: [],
    attribs: {}
  })
}

CoraliteComponentPrototype.createTextNode = function (data) {
  return createCoraliteTextNode({
    type: 'text',
    data
  })
}

CoraliteComponentPrototype.createComment = function (data) {
  return createCoraliteComment({
    type: 'comment',
    data
  })
}

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
  node.type = node.type || 'text'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Comment Node
 * @param {RawCoraliteComment} node - The raw comment node
 * @returns {CoraliteComment} The enhanced Coralite Comment Node
 */
export function createCoraliteComment (node) {
  node.type = node.type || 'comment'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Directive Node (e.g. DOCTYPE)
 * @param {RawCoraliteDirective} node - The raw directive node
 * @returns {CoraliteDirective} The enhanced Coralite Directive Node
 */
export function createCoraliteDirective (node) {
  node.type = node.type || 'directive'
  return enhanceNode(node)
}

/**
 * Creates an enhanced Coralite Document Root
 * @param {RawCoraliteComponentRoot} node - The raw document node
 * @returns {CoraliteComponentRoot} The enhanced Coralite Document Root
 */
export function createCoraliteComponent (node) {
  node.type = node.type || 'root'
  return enhanceNode(node)
}
