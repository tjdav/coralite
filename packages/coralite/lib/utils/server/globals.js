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
    /** @type {Map<string, Set<{listener: Function, options?: any}>>} */
    this._listeners = new Map()
  }

  /**
   * Document title getter/setter bound to page metadata context.
   * @returns {string}
   */
  get title () {
    return this.context.page?.meta?.title || ''
  }

  /**
   * Sets document title.
   * @param {string} val - Title string
   */
  set title (val) {
    if (this.context.page) {
      if (!this.context.page.meta) {
        this.context.page.meta = {}
      }
      this.context.page.meta.title = String(val ?? '')
    }
  }

  /**
   * Adds an event listener to the document.
   * @param {string} type - Event type
   * @param {Function} listener - Listener callback
   * @param {Object} [options] - Listener options
   */
  addEventListener (type, listener, options) {
    if (typeof listener !== 'function') {
      return
    }
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set())
    }
    this._listeners.get(type).add({
      listener,
      options
    })
  }

  /**
   * Removes an event listener from the document.
   * @param {string} type - Event type
   * @param {Function} listener - Listener callback
   */
  removeEventListener (type, listener) {
    if (!this._listeners.has(type)) {
      return
    }
    const set = this._listeners.get(type)
    for (const item of set) {
      if (item.listener === listener) {
        set.delete(item)
        break
      }
    }
  }

  /**
   * Dispatches an event on the document.
   * @param {any} event - Event to dispatch
   * @returns {boolean}
   */
  dispatchEvent (event) {
    if (!event || typeof event.type !== 'string') {
      return false
    }
    if (!this._listeners.has(event.type)) {
      return true
    }
    const set = Array.from(this._listeners.get(event.type))
    for (const item of set) {
      try {
        item.listener.call(this, event)
      } catch (err) {
        queueMicrotask(() => {
          throw err
        })
      }
    }
    return !event.defaultPrevented
  }

  /**
   * Creates a new element with the specified tag name.
   * @param {string} tagName - Tag name
   * @param {Record<string, any>} [_options] - Element options
   * @returns {import('../../../types/index.js').CoraliteElement}
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

  const pathname = context.page?.url?.pathname || context.page?.route || '/'
  const href = context.page?.url?.href || `http://localhost${pathname}`
  const search = context.page?.url?.search || ''
  const hash = context.page?.url?.hash || ''
  const origin = context.page?.url?.origin || 'http://localhost'

  /** @type {Map<string, Set<{listener: Function, options?: any}>>} */
  const winListeners = new Map()

  const win = {
    document,
    location: {
      href,
      pathname,
      search,
      hash,
      origin
    },
    addEventListener (type, listener, options) {
      if (typeof listener !== 'function') {
        return
      }
      if (!winListeners.has(type)) {
        winListeners.set(type, new Set())
      }
      winListeners.get(type).add({
        listener,
        options
      })
    },
    removeEventListener (type, listener) {
      if (!winListeners.has(type)) {
        return
      }
      const set = winListeners.get(type)
      for (const item of set) {
        if (item.listener === listener) {
          set.delete(item)
          break
        }
      }
    },
    dispatchEvent (event) {
      if (!event || typeof event.type !== 'string') {
        return false
      }
      if (!winListeners.has(event.type)) {
        return true
      }
      const set = Array.from(winListeners.get(event.type))
      for (const item of set) {
        try {
          item.listener.call(win, event)
        } catch (err) {
          queueMicrotask(() => {
            throw err
          })
        }
      }
      return !event.defaultPrevented
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
