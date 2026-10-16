import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

function createMockElement (tagName = 'div') {
  const children = []
  const attributes = new Map()
  const style = {}

  return {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    style,
    setAttribute (k, v) {
      attributes.set(k, String(v))
    },
    getAttribute (k) {
      return attributes.get(k)
    },
    appendChild (child) {
      child.parentNode = this
      children.push(child)
      return child
    },
    remove () {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this)
        if (idx !== -1) {
          this.parentNode.children.splice(idx, 1)
        }
        this.parentNode = null
      }
    },
    replaceChildren (...newChildren) {
      for (const child of children) {
        child.parentNode = null
      }
      children.length = 0
      for (const child of newChildren) {
        if (child) {
          child.parentNode = this
          children.push(child)
        }
      }
    }
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement (tag) {
      return createMockElement(tag)
    }
  }
}

describe('lists plugin - virtual: window', () => {
  let mockResizeObserverCallback = null
  let observedElements = []
  const originalResizeObserver = globalThis.ResizeObserver
  const originalRAF = globalThis.requestAnimationFrame

  beforeEach(() => {
    observedElements = []
    globalThis.ResizeObserver = class MockResizeObserver {
      constructor (cb) {
        mockResizeObserverCallback = cb
      }

      observe (el) {
        observedElements.push(el)
      }

      unobserve (el) {
        observedElements = observedElements.filter((e) => e !== el)
      }

      disconnect () {
        observedElements = []
      }
    }

    globalThis.requestAnimationFrame = (cb) => {
      cb()
      return 1
    }
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
    globalThis.requestAnimationFrame = originalRAF
  })

  function createMockContainer (height = 300) {
    const el = createMockElement('div')
    el.clientHeight = height
    el.scrollTop = 0
    el.listeners = {}
    el.addEventListener = (event, cb, options) => {
      el.listeners[event] = {
        cb,
        options
      }
    }
    el.removeEventListener = (event, cb) => {
      if (el.listeners[event]?.cb === cb) {
        delete el.listeners[event]
      }
    }
    return el
  }

  function createMockRow (text) {
    const el = createMockElement('div')
    el.className = 'lists-row'
    el.textContent = text
    return el
  }

  it('renders only visible range plus overscan rows and spacer elements', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Message ${i}`
    }))
    const store = createStore({ initial: items })
    // Viewport height = 300px
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window',
      // 50px per item -> 6 items fit in viewport (0..300px: items 0..6)
      size: 50,
      overscan: 2
    })

    assert.equal(container.style.overflowAnchor, 'none')

    const topSpacer = container.children.find((c) => c.className === 'lists-spacer-top')
    const bottomSpacer = container.children.find((c) => c.className === 'lists-spacer-bottom')
    const rows = container.children.filter((c) => c.className === 'lists-row')

    assert.ok(topSpacer)
    assert.ok(bottomSpacer)
    assert.equal(topSpacer.style.height, '0px')
    // 100 items * 50 = 5000px. Rendered items 0..8 (9 items, height = 450px). Bottom spacer = 5000 - 450 = 4550px
    assert.equal(bottomSpacer.style.height, '4550px')
    assert.equal(rows.length, 9)
    assert.equal(rows[0].textContent, 'Message 0')
    assert.equal(rows[8].textContent, 'Message 8')

    handle.destroy()
  })

  it('scrolling updates visible rows and spacer heights using passive scroll listener', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Message ${i}`
    }))
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window',
      size: 50,
      overscan: 2
    })

    assert.equal(container.listeners.scroll?.options?.passive, true)

    // Scroll to scrollTop = 1000px (item-20 is at y=1000px)
    container.scrollTop = 1000
    container.listeners.scroll.cb()

    const topSpacer = container.children.find((c) => c.className === 'lists-spacer-top')
    const rows = container.children.filter((c) => c.className === 'lists-row')

    // Visible range for 1000..1300 = items 20..26. With overscan=2 -> items 18..28 (11 items)
    // 18 * 50 = 900px
    assert.equal(topSpacer.style.height, '900px')
    assert.equal(rows[0].textContent, 'Message 18')
    assert.equal(rows[rows.length - 1].textContent, 'Message 28')

    handle.destroy()
  })

  it('reacts to store append, remove, and update mutations', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Message ${i}`
    }))
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      update: (el, item) => {
        el.textContent = item.text
      },
      virtual: 'window',
      size: 50,
      overscan: 2
    })

    // Initial render: items 0..8 rendered (9 items)
    let rows = container.children.filter((c) => c.className === 'lists-row')
    assert.equal(rows.length, 9)

    // Update item
    store.update('msg-2', { text: 'Updated Message 2' })
    assert.equal(rows[2].textContent, 'Updated Message 2')

    // Append item
    store.append({
      id: 'msg-10',
      text: 'Message 10'
    })
    rows = container.children.filter((c) => c.className === 'lists-row')
    assert.equal(rows.length, 9)

    // Remove item
    store.remove('msg-0')
    rows = container.children.filter((c) => c.className === 'lists-row')
    assert.equal(rows[0].textContent, 'Message 1')

    handle.destroy()
  })

  it('handles size: "measure" using ResizeObserver for dynamic row heights', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Message ${i}`
    }))
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window',
      size: 'measure',
      overscan: 2
    })

    assert.ok(observedElements.length > 0)

    // Trigger ResizeObserver callback for first rendered row changing height from 64 to 100
    mockResizeObserverCallback([
      {
        target: observedElements[0],
        borderBoxSize: [{ blockSize: 100 }]
      }
    ])

    const bottomSpacer = container.children.find((c) => c.className === 'lists-spacer-bottom')
    assert.ok(bottomSpacer)

    handle.destroy()
    assert.equal(observedElements.length, 0)
  })

  it('scales spacer heights when totalHeight exceeds 33,000,000 max safe height', () => {
    const items = Array.from({ length: 100_000 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Msg ${i}`
    }))
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window',
      // 100,000 items * 400px = 40,000,000px > 33,000,000px
      size: 400,
      overscan: 1
    })

    const bottomSpacer = container.children.find((c) => c.className === 'lists-spacer-bottom')
    assert.ok(bottomSpacer)

    const parsedHeight = parseFloat(bottomSpacer.style.height)
    assert.ok(parsedHeight < 33_000_000)

    handle.destroy()
  })

  it('reanchors to successor when anchor item is removed', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      text: `Msg ${i}`
    }))
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window',
      size: 50,
      overscan: 1
    })

    // Scroll to item 10
    container.scrollTop = 500
    container.listeners.scroll.cb()

    // Remove anchor item (msg-10)
    store.remove('msg-10')

    const rows = container.children.filter((c) => c.className === 'lists-row')
    // msg-9 is overscan before msg-11
    assert.equal(rows[0].textContent, 'Msg 9')

    handle.destroy()
  })

  it('logs console.warn when container is not scrollable in development', () => {
    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)

    const store = createStore({
      initial: [{
        id: '1',
        text: '1'
      }]
    })
    const container = createMockContainer(300)
    container.style.overflow = 'visible'

    // Mock window.getComputedStyle
    const originalGetComputedStyle = globalThis.window?.getComputedStyle
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {}
    }
    globalThis.window.getComputedStyle = () => ({
      overflow: 'visible',
      overflowY: 'visible'
    })

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window'
    })

    assert.ok(warnings.some((w) => w.includes('Container does not have scrollable overflow')))

    console.warn = originalWarn
    if (originalGetComputedStyle) {
      globalThis.window.getComputedStyle = originalGetComputedStyle
    }
    handle.destroy()
  })

  it('destroy() cleans up listeners, observers, and spacers without removing rows', () => {
    const items = [{
      id: '1',
      text: '1'
    }, {
      id: '2',
      text: '2'
    }]
    const store = createStore({ initial: items })
    const container = createMockContainer(300)

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => createMockRow(item.text),
      virtual: 'window'
    })

    assert.ok(container.listeners.scroll)
    assert.equal(container.style.overflowAnchor, 'none')

    handle.destroy()

    assert.equal(container.listeners.scroll, undefined)
    assert.equal(container.style.overflowAnchor, '')
    assert.equal(container.children.find((c) => c.className === 'lists-spacer-top'), undefined)
    assert.equal(container.children.find((c) => c.className === 'lists-spacer-bottom'), undefined)
  })
})
