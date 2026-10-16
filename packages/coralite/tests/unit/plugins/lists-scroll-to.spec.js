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

describe('lists - scrollToKey & getAnchor', () => {
  let store

  beforeEach(() => {
    store = createStore({
      key: (item) => item.id,
      initial: Array.from({ length: 20 }, (_, i) => ({ id: `item-${i + 1}` }))
    })
  })

  it('scrollToKey(id, { align: "start" }) places item top at viewport top', () => {
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
      overscan: 1
    })

    // item-10 is at y = 9 * 50 = 450px.
    handle.scrollToKey('item-10', { align: 'start' })
    assert.equal(container.scrollTop, 450)

    handle.destroy()
  })

  it('scrollToKey(id, { align: "center" }) places item center at viewport center', () => {
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
      overscan: 1
    })

    // item-10: y = 450px, height = 50px, center = 475px. Viewport = 200px (half = 100px).
    // Target scrollTop = 475 - 100 = 375px.
    handle.scrollToKey('item-10', { align: 'center' })
    assert.equal(container.scrollTop, 375)

    handle.destroy()
  })

  it('scrollToKey(id, { align: "end" }) places item bottom at viewport bottom', () => {
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
      overscan: 1
    })

    // item-10: y = 450px, bottom = 500px. Target scrollTop = 500 - 200 = 300px.
    handle.scrollToKey('item-10', { align: 'end' })
    assert.equal(container.scrollTop, 300)

    handle.destroy()
  })

  it('scrollToKey(id, { align: "auto" }) does nothing if item is already visible', () => {
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
      overscan: 1
    })

    // container.scrollTop is initially 0. item-2 is at y = 50px, bottom = 100px (fully within 0..200px).
    handle.scrollToKey('item-2', { align: 'auto' })
    assert.equal(container.scrollTop, 0)

    handle.destroy()
  })

  it('getAnchor() returns a copy of current anchor and mutating copy does not alter internal state', () => {
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
      size: 50
    })

    const anchor1 = handle.getAnchor()
    assert.notEqual(anchor1, null)
    assert.equal(anchor1.key, 'item-1')

    // Mutate anchor1 copy
    anchor1.key = 'MUTATED'
    anchor1.offset = 999

    const anchor2 = handle.getAnchor()
    assert.equal(anchor2.key, 'item-1')
    assert.notEqual(anchor2.key, 'MUTATED')

    handle.destroy()
  })
})
