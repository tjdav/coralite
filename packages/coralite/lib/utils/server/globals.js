import { createCoraliteElement, createCoraliteTextNode, createCoraliteComment, createCoraliteComponent } from './dom.js'

/**
 * Server representation of the DOM Document interface.
 */
export class CoraliteDocument {
  /**
   * @param {Record<string, any>} [context={}] - Context options
   */
  constructor (context = {}) {
    this.context = context
    this.head = createCoraliteElement({
      type: 'tag',
      name: 'head',
      attribs: {},
      children: []
    })
    this.body = createCoraliteElement({
      type: 'tag',
      name: 'body',
      attribs: {},
      children: []
    })
    this.documentElement = createCoraliteElement({
      type: 'tag',
      name: 'html',
      attribs: {},
      children: [this.head, this.body]
    })
    this.nodeType = 9
    this.nodeName = '#document'
  }

  /**
   * Creates a new element with the specified tag name.
   * @param {string} tagName - Tag name
   * @param {Record<string, any>} [_options] - Element options
   */
  createElement (tagName, _options) {
    return createCoraliteElement({
      type: 'tag',
      name: String(tagName || '').toLowerCase(),
      attribs: {},
      children: []
    })
  }

  /**
   * Creates a new text node.
   * @param {any} text - Text content
   */
  createTextNode (text) {
    return createCoraliteTextNode({
      type: 'text',
      data: String(text ?? '')
    })
  }

  /**
   * Creates a new comment node.
   * @param {any} data - Comment content
   */
  createComment (data) {
    return createCoraliteComment({
      type: 'comment',
      data: String(data ?? '')
    })
  }

  /**
   * Creates a document fragment.
   */
  createDocumentFragment () {
    return createCoraliteComponent({
      type: 'root',
      children: []
    })
  }

  /**
   * Queries the document element for the first matching node.
   * @param {string} selector - CSS selector
   */
  querySelector (selector) {
    return this.documentElement.querySelector(selector)
  }

  /**
   * Queries the document element for all matching nodes.
   * @param {string} selector - CSS selector
   */
  querySelectorAll (selector) {
    return this.documentElement.querySelectorAll(selector)
  }

  /**
   * Finds an element by ID.
   * @param {string} id - Element ID
   */
  getElementById (id) {
    return this.documentElement.getElementById(id)
  }

  /**
   * Finds elements by tag name.
   * @param {string} tag - Tag name
   */
  getElementsByTagName (tag) {
    return this.documentElement.getElementsByTagName(tag)
  }

  /**
   * Finds elements by class name.
   * @param {string} cls - Class name
   */
  getElementsByClassName (cls) {
    return this.documentElement.getElementsByClassName(cls)
  }
}

/**
 * Creates a lightweight virtual window for server rendering contexts.
 * @param {Record<string, any>} [context={}] - Render context
 */
export function createVirtualWindow (context = {}) {
  const document = new CoraliteDocument(context)
  const win = {
    document,
    location: {
      href: context.page?.route || '/',
      pathname: context.page?.route || '/',
      search: '',
      hash: '',
      origin: 'http://localhost'
    },
    getComputedStyle (element) {
      return element?.style || {}
    },
    matchMedia (query) {
      return {
        matches: false,
        media: String(query || ''),
        addEventListener () {
        },
        removeEventListener () {
        },
        addListener () {
        },
        removeListener () {
        },
        dispatchEvent () {
          return false
        }
      }
    },
    requestAnimationFrame (cb) {
      return setTimeout(() => cb(Date.now()), 0)
    },
    cancelAnimationFrame (id) {
      clearTimeout(id)
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    CustomEvent: globalThis.CustomEvent || class CustomEvent {
      constructor (type, options = {}) {
        this.type = type
        this.detail = options.detail ?? null
        this.bubbles = Boolean(options.bubbles)
        this.cancelable = Boolean(options.cancelable)
        this.defaultPrevented = false
      }

      preventDefault () {
        if (this.cancelable) {
          this.defaultPrevented = true
        }
      }
    },
    Event: globalThis.Event || class Event {
      constructor (type, options = {}) {
        this.type = type
        this.bubbles = Boolean(options.bubbles)
        this.cancelable = Boolean(options.cancelable)
        this.defaultPrevented = false
      }

      preventDefault () {
        if (this.cancelable) {
          this.defaultPrevented = true
        }
      }
    }
  }

  win.window = win
  win.self = win
  return win
}
