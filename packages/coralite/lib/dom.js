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
  for (let node of nodes) {
    if (typeof node === 'string') {
      node = createCoraliteTextNode({
        type: 'text',
        data: node
      })
    }
    this.appendChild(node)
  }
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
const CoraliteComponentPrototype = Object.create(CoraliteNodePrototype)

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
