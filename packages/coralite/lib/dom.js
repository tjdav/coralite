/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteDocumentRoot,
 *  CoraliteComment,
 *  CoraliteDirective,
 *  RawCoraliteElement,
 *  RawCoraliteTextNode,
 *  RawCoraliteComment,
 *  RawCoraliteDirective,
 *  RawCoraliteDocumentRoot
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
 * Base enhancer for all Coralite nodes
 * @template {RawCoraliteElement | RawCoraliteTextNode | RawCoraliteComment | RawCoraliteDirective | RawCoraliteDocumentRoot} T
 * @param {T} node
 */
function CoraliteNode (node) {
  Object.assign(this, node)
}

Object.defineProperties(CoraliteNode.prototype, {
  nodeType: {
    /**
     * Returns an integer identifying the type of the node.
     * @returns {number}
     */
    get () {
      return nodeTypes[this.type] || ELEMENT_NODE
    }
  },
  parentNode: {
    /**
     * Returns the parent of the specified node in the DOM tree.
     * @returns {CoraliteAnyNode | CoraliteDocumentRoot}
     */
    get () {
      return this.parent
    },
    /**
     * Sets the parent of the node.
     * @param {CoraliteAnyNode | CoraliteDocumentRoot} value
     */
    set (value) {
      this.parent = value
    }
  },
  parentElement: {
    /**
     * Returns the DOM node's parent Element, or null if the node either has no parent, or its parent isn't a DOM Element.
     * @returns {CoraliteAnyNode | CoraliteDocumentRoot}
     */
    get () {
      return this.parent
    },
    /**
     * Sets the parent element of the node.
     * @param {CoraliteAnyNode | CoraliteDocumentRoot} value
     */
    set (value) {
      this.parent = value
    }
  },
  previousSibling: {
    /**
     * Returns the node immediately preceding the specified one in its parent's childNodes list, or null if the specified node is the first in that list.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      if (!this.parent || !this.parent.children) return null
      const index = this.parent.children.indexOf(this)
      return index > 0 ? this.parent.children[index - 1] : null
    }
  },
  nextSibling: {
    /**
     * Returns the node immediately following the specified one in its parent's childNodes list, or null if the specified node is the last node in that list.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      if (!this.parent || !this.parent.children) return null
      const index = this.parent.children.indexOf(this)
      return index > -1 && index < this.parent.children.length - 1 ? this.parent.children[index + 1] : null
    }
  }
})

/**
 * Coralite Element Node Constructor
 * @param {RawCoraliteElement} node
 */
function CoraliteElement (node) {
  CoraliteNode.call(this, node)
}

CoraliteElement.prototype = Object.create(CoraliteNode.prototype)
CoraliteElement.prototype.constructor = CoraliteElement


Object.defineProperties(CoraliteElement.prototype, {
  nodeName: {
    /**
     * Returns the name of the node (uppercase tag name for elements).
     * @returns {string}
     */
    get () {
      return this.name.toUpperCase()
    }
  },
  tagName: {
    /**
     * Returns the tag name of the element (uppercase).
     * @returns {string}
     */
    get () {
      return this.name.toUpperCase()
    },
    /**
     * Sets the tag name of the element (converted to lowercase).
     * @param {string} value
     */
    set (value) {
      this.name = value.toLowerCase()
    }
  },
  nodeValue: {
    /**
     * Returns null for elements.
     * @returns {null}
     */
    get () {
      return null
    },
    /**
     * Setting nodeValue on an element has no effect.
     */
    set (value) {
      // Elements do not have nodeValue
    }
  },
  attributes: {
    /**
     * Returns a collection of the element's attributes.
     * @returns {Object.<string, string>}
     */
    get () {
      return this.attribs
    },
    /**
     * Sets the attributes of the element.
     * @param {Object.<string, string>} value
     */
    set (value) {
      this.attribs = value
    }
  },
  childNodes: {
    /**
     * Returns a live collection of child nodes of the given element.
     * @returns {CoraliteAnyNode[]}
     */
    get () {
      return this.children || []
    },
    /**
     * Sets the child nodes of the element.
     * @param {CoraliteAnyNode[]} value
     */
    set (value) {
      this.children = value
    }
  },
  firstChild: {
    /**
     * Returns the node's first child in the tree, or null if the node has no children.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      return this.children && this.children.length > 0 ? this.children[0] : null
    }
  },
  lastChild: {
    /**
     * Returns the last child of the node, or null if there are no child nodes.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      return this.children && this.children.length > 0 ? this.children[this.children.length - 1] : null
    }
  },
  textContent: {
    /**
     * Returns the text content of the node and its descendants.
     * @returns {string}
     */
    get () {
      if (this.children) {
        return this.children.map(child => child.textContent).join('')
      }
      return ''
    },
    /**
     * Sets the text content of the node. Replaces all children with a single text node.
     * @param {string} value
     */
    set (value) {
      // Replace all children with a single text node
      const textNode = createCoraliteTextNode({
        type: 'text',
        data: value,
        parent: this
      })
      this.children = [textNode]
    }
  },
  id: {
    /**
     * Returns the element's ID attribute.
     * @returns {string}
     */
    get () {
      return this.attribs ? this.attribs.id : ''
    },
    /**
     * Sets the element's ID attribute.
     * @param {string} value
     */
    set (value) {
      if (this.attribs) {
        this.attribs.id = value
      }
    }
  },
  className: {
    /**
     * Returns the element's class attribute.
     * @returns {string}
     */
    get () {
      return this.attribs ? this.attribs.class : ''
    },
    /**
     * Sets the element's class attribute.
     * @param {string} value
     */
    set (value) {
      if (this.attribs) {
        this.attribs.class = value
      }
    }
  }
})

/**
 * Creates an enhanced Coralite Element
 * @param {RawCoraliteElement} node
 * @returns {CoraliteElement}
 */
export function createCoraliteElement (node) {
  Object.setPrototypeOf(node, CoraliteElement.prototype)
  // @ts-ignore
  return node
}

/**
 * Coralite Text Node Constructor
 * @param {RawCoraliteTextNode} node
 */
function CoraliteTextNode (node) {
  CoraliteNode.call(this, node)
}

CoraliteTextNode.prototype = Object.create(CoraliteNode.prototype)
CoraliteTextNode.prototype.constructor = CoraliteTextNode

Object.defineProperties(CoraliteTextNode.prototype, {
  nodeName: {
    /**
     * Returns the name of the node (#text).
     * @returns {string}
     */
    get () {
      return '#text'
    }
  },
  nodeValue: {
    /**
     * Returns the text content of the node.
     * @returns {string}
     */
    get () {
      return this.data
    },
    /**
     * Sets the text content of the node.
     * @param {string} value
     */
    set (value) {
      this.data = value
    }
  },
  textContent: {
    /**
     * Returns the text content of the node.
     * @returns {string}
     */
    get () {
      return this.data
    },
    /**
     * Sets the text content of the node.
     * @param {string} value
     */
    set (value) {
      this.data = value
    }
  }
})

/**
 * Creates an enhanced Coralite Text Node
 * @param {RawCoraliteTextNode} node
 * @returns {CoraliteTextNode}
 */
export function createCoraliteTextNode (node) {
  Object.setPrototypeOf(node, CoraliteTextNode.prototype)
  // @ts-ignore
  return node
}

/**
 * Coralite Comment Node Constructor
 * @param {RawCoraliteComment} node
 */
function CoraliteComment (node) {
  CoraliteNode.call(this, node)
}

CoraliteComment.prototype = Object.create(CoraliteNode.prototype)
CoraliteComment.prototype.constructor = CoraliteComment

Object.defineProperties(CoraliteComment.prototype, {
  nodeName: {
    /**
     * Returns the name of the node (#comment).
     * @returns {string}
     */
    get () {
      return '#comment'
    }
  },
  nodeValue: {
    /**
     * Returns the content of the comment.
     * @returns {string}
     */
    get () {
      return this.data
    },
    /**
     * Sets the content of the comment.
     * @param {string} value
     */
    set (value) {
      this.data = value
    }
  },
  textContent: {
    /**
     * Returns the content of the comment.
     * @returns {string}
     */
    get () {
      return this.data
    },
    /**
     * Sets the content of the comment.
     * @param {string} value
     */
    set (value) {
      this.data = value
    }
  }
})

/**
 * Creates an enhanced Coralite Comment Node
 * @param {RawCoraliteComment} node
 * @returns {CoraliteComment}
 */
export function createCoraliteComment (node) {
  Object.setPrototypeOf(node, CoraliteComment.prototype)
  // @ts-ignore
  return node
}

/**
 * Coralite Directive Node Constructor
 * @param {RawCoraliteDirective} node
 */
function CoraliteDirective (node) {
  CoraliteNode.call(this, node)
}

CoraliteDirective.prototype = Object.create(CoraliteNode.prototype)
CoraliteDirective.prototype.constructor = CoraliteDirective

Object.defineProperties(CoraliteDirective.prototype, {
  nodeName: {
    /**
     * Returns the name of the directive (e.g., !DOCTYPE).
     * @returns {string}
     */
    get () {
      return this.name
    }
  },
  nodeValue: {
    /**
     * Returns the content of the directive.
     * @returns {string}
     */
    get () {
      return this.data
    },
    /**
     * Sets the content of the directive.
     * @param {string} value
     */
    set (value) {
      this.data = value
    }
  }
})

/**
 * Creates an enhanced Coralite Directive Node (e.g. DOCTYPE)
 * @param {RawCoraliteDirective} node
 * @returns {CoraliteDirective}
 */
export function createCoraliteDirective (node) {
  Object.setPrototypeOf(node, CoraliteDirective.prototype)
  // @ts-ignore
  return node
}

/**
 * Coralite Document Node Constructor
 * @param {RawCoraliteDocumentRoot} node
 */
function CoraliteDocument (node) {
  CoraliteNode.call(this, node)
}

CoraliteDocument.prototype = Object.create(CoraliteNode.prototype)
CoraliteDocument.prototype.constructor = CoraliteDocument

Object.defineProperties(CoraliteDocument.prototype, {
  nodeName: {
    /**
     * Returns the name of the node (#document).
     * @returns {string}
     */
    get () {
      return '#document'
    }
  },
  nodeValue: {
    /**
     * Returns null for document nodes.
     * @returns {null}
     */
    get () {
      return null
    }
  },
  childNodes: {
    /**
     * Returns a live collection of child nodes of the document.
     * @returns {CoraliteAnyNode[]}
     */
    get () {
      return this.children || []
    },
    /**
     * Sets the child nodes of the document.
     * @param {CoraliteAnyNode[]} value
     */
    set (value) {
      this.children = value
    }
  },
  firstChild: {
    /**
     * Returns the document's first child in the tree, or null if the document has no children.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      return this.children && this.children.length > 0 ? this.children[0] : null
    }
  },
  lastChild: {
    /**
     * Returns the last child of the document, or null if there are no child nodes.
     * @returns {CoraliteAnyNode | null}
     */
    get () {
      return this.children && this.children.length > 0 ? this.children[this.children.length - 1] : null
    }
  },
  textContent: {
    /**
     * Returns null for document nodes.
     * @returns {null}
     */
    get () {
      return null // Document nodes don't have text content in the same way
    }
  }
})

/**
 * Creates an enhanced Coralite Document Root
 * @param {RawCoraliteDocumentRoot} node
 * @returns {CoraliteDocumentRoot}
 */
export function createCoraliteDocument (node) {
  Object.setPrototypeOf(node, CoraliteDocument.prototype)
  // @ts-ignore
  return node
}
