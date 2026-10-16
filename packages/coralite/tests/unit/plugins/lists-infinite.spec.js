import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

function createMockContainer (height = 200) {
  const children = []
  let scrollTopVal = 0

  const container = {
    clientHeight: height,
    style: {},
    get scrollTop () {
      return scrollTopVal
    },
    set scrollTop (val) {
      scrollTopVal = val
    },
    get scrollHeight () {
      return children.length * 50
    },
    replaceChildren (...nodes) {
      children.length = 0
      children.push(...nodes)
    },
    appendChild (node) {
      children.push(node)
    },
    insertBefore (node, refNode) {
      const idx = children.indexOf(refNode)
      if (idx !== -1) {
        children.splice(idx, 0, node)
      } else {
        children.push(node)
      }
    },
    removeChild (node) {
      const idx = children.indexOf(node)
      if (idx !== -1) {
        children.splice(idx, 1)
      }
    },
    addEventListener () {
    },
    removeEventListener () {
    },
    _children: children
  }

  return container
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement (tag) {
      return createMockContainer(tag)
    }
  }
}

describe('lists - infinite scroll sentinels', () => {
  let store
  let origIntersectionObserver

  beforeEach(() => {
    store = createStore({
      key: (item) => item.id,
      initial: Array.from({ length: 20 }, (_, i) => ({ id: `item-${i + 1}` }))
    })

    origIntersectionObserver = globalThis.IntersectionObserver
  })

  it('renders sentinels and sets up IntersectionObserver with reachThreshold', () => {
    const observedElements = []
    let observerOptions = null
    let disconnected = false

    globalThis.IntersectionObserver = class MockIntersectionObserver {
      constructor (cb, opts) {
        observerOptions = opts
        this.cb = cb
      }

      observe (el) {
        observedElements.push(el)
      }

      disconnect () {
        disconnected = true
      }
    }

    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      reachThreshold: 300,
      onReachStart: () => {
      },
      onReachEnd: () => {
      }
    })

    assert.equal(observerOptions.rootMargin, '300px 0px')
    assert.equal(observedElements.length, 2)
    assert.equal(observedElements[0].className, 'lists-sentinel-top')
    assert.equal(observedElements[1].className, 'lists-sentinel-bottom')

    handle.destroy()
    assert.equal(disconnected, true)

    globalThis.IntersectionObserver = origIntersectionObserver
  })

  it('triggers onReachStart and onReachEnd when sentinel intersection occurs', () => {
    let observerCb = null

    globalThis.IntersectionObserver = class MockIntersectionObserver {
      constructor (cb) {
        observerCb = cb
      }

      observe () {
      }
      disconnect () {
      }
    }

    let reachStartCount = 0
    let reachEndCount = 0

    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      onReachStart: () => {
        reachStartCount++
      },
      onReachEnd: () => {
        reachEndCount++
      }
    })

    const topSentinel = container._children.find((c) => c.className === 'lists-sentinel-top')
    const bottomSentinel = container._children.find((c) => c.className === 'lists-sentinel-bottom')

    assert.notEqual(topSentinel, undefined)
    assert.notEqual(bottomSentinel, undefined)

    // Simulate top sentinel entering viewport
    observerCb([
      {
        target: topSentinel,
        isIntersecting: true
      }
    ])
    assert.equal(reachStartCount, 1)
    assert.equal(reachEndCount, 0)

    // Simulate bottom sentinel entering viewport
    observerCb([
      {
        target: bottomSentinel,
        isIntersecting: true
      }
    ])
    assert.equal(reachStartCount, 1)
    assert.equal(reachEndCount, 1)

    // Simulate non-intersecting entry
    observerCb([
      {
        target: topSentinel,
        isIntersecting: false
      }
    ])
    assert.equal(reachStartCount, 1)

    handle.destroy()
    globalThis.IntersectionObserver = origIntersectionObserver
  })
})
