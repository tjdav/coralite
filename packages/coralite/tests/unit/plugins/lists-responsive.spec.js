import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createMeasurementCache } from '../../../plugins/lists/measurements.js'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

function createMockElement (tagName = 'div', width = 800, height = 400) {
  const children = []
  const attributes = new Map()

  return {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    clientWidth: width,
    clientHeight: height,
    scrollTop: 0,
    style: {},
    setAttribute (k, v) {
      attributes.set(k, String(v))
    },
    getAttribute (k) {
      return attributes.get(k)
    },
    appendChild (child) {
      if (!child) {
        return child
      }
      if (child.type === 'fragment') {
        const fragChildren = [...child.children]
        child.children.length = 0
        for (const fc of fragChildren) {
          this.appendChild(fc)
        }
        return child
      }
      child.parentNode = this
      children.push(child)
      return child
    },
    insertBefore (child, referenceChild) {
      if (!child) {
        return child
      }
      if (!referenceChild) {
        return this.appendChild(child)
      }
      const idx = children.indexOf(referenceChild)
      if (idx !== -1) {
        child.parentNode = this
        children.splice(idx, 0, child)
      } else {
        this.appendChild(child)
      }
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
        if (!child) {
          continue
        }
        if (child.type === 'fragment') {
          const fragChildren = [...child.children]
          child.children.length = 0
          for (const fc of fragChildren) {
            fc.parentNode = this
            children.push(fc)
          }
        } else {
          child.parentNode = this
          children.push(child)
        }
      }
    },
    get firstChild () {
      return children[0] || null
    },
    addEventListener () {
    },
    removeEventListener () {
    }
  }
}

function createMockFragment () {
  const children = []
  return {
    type: 'fragment',
    children,
    appendChild (child) {
      if (child) {
        children.push(child)
      }
      return child
    }
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement (tag) {
      return createMockElement(tag)
    },
    createDocumentFragment () {
      return createMockFragment()
    }
  }
}

describe('lists plugin - responsive & layout signatures', () => {
  it('measurement cache is keyed by (itemKey, layoutSignature)', () => {
    const measurements = createMeasurementCache(50)
    const key = 'item-1'
    const sig1 = '3:280:900'
    const sig2 = '4:280:1200'

    measurements.set(key, sig1, 120)
    measurements.set(key, sig2, 80)

    assert.equal(measurements.get(key, sig1), 120)
    assert.equal(measurements.get(key, sig2), 80)
    assert.equal(measurements.get(key, '2:280:600'), 50)
  })

  it('changing container width preserves old measurements and reuses them on resize back', () => {
    const measurements = createMeasurementCache(60)
    const key = 'item-1'

    measurements.set(key, '2:400:800', 100)
    measurements.set(key, '3:266:800', 140)

    assert.equal(measurements.get(key, '2:400:800'), 100)
    assert.equal(measurements.get(key, '3:266:800'), 140)
  })

  it('non-linear layout with virtual: false positions all items absolutely', () => {
    const store = createStore({
      initial: Array.from({ length: 4 }, (_, i) => ({
        id: `item-${i}`,
        text: `Item ${i}`
      }))
    })

    const container = createMockElement('div', 800, 400)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: () => createMockElement('div'),
      layout: 'grid',
      lanes: 2,
      gap: 10,
      size: 50,
      virtual: false
    })

    assert.equal(container.style.position, 'relative')
    assert.equal(container.children.length, 4)

    const item0 = container.children[0]
    const item1 = container.children[1]
    const item2 = container.children[2]

    assert.equal(item0.style.position, 'absolute')
    assert.equal(item0.style.left, '0px')
    assert.equal(item0.style.top, '0px')

    assert.equal(item1.style.position, 'absolute')
    assert.equal(item1.style.left, '405px')
    assert.equal(item1.style.top, '0px')

    assert.equal(item2.style.position, 'absolute')
    assert.equal(item2.style.left, '0px')
    assert.equal(item2.style.top, '60px')

    handle.destroy()
  })

  it('non-linear layout with virtual: "window" renders only visible window', () => {
    const store = createStore({
      initial: Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        text: `Item ${i}`
      }))
    })

    const container = createMockElement('div', 800, 300)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: () => createMockElement('div'),
      layout: 'grid',
      lanes: 2,
      gap: 0,
      size: 50,
      overscan: 2,
      virtual: 'window'
    })

    assert.ok(container.children.length < 30)

    handle.destroy()
  })
})
