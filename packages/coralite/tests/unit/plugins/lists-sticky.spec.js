import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

function createMockElement (tagName = 'div') {
  const children = []
  const attributes = new Map()

  return {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    style: {},
    setAttribute (k, v) {
      attributes.set(k, String(v))
    },
    getAttribute (k) {
      return attributes.get(k)
    },
    hasAttribute (k) {
      return attributes.has(k)
    },
    appendChild (child) {
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

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement (tag) {
      return createMockElement(tag)
    },
    createDocumentFragment () {
      return {
        type: 'fragment',
        children: [],
        appendChild (c) {
          this.children.push(c)
          return c
        }
      }
    }
  }
}

describe('lists plugin - sticky headers', () => {
  let container
  let store

  beforeEach(() => {
    container = createMockElement('div')
    store = createStore({
      key: (item) => item.id,
      initial: [
        {
          id: '1',
          name: 'Item A1',
          group: 'Alpha'
        },
        {
          id: '2',
          name: 'Item A2',
          group: 'Alpha'
        },
        {
          id: '3',
          name: 'Item B1',
          group: 'Beta'
        },
        {
          id: '4',
          name: 'Item B2',
          group: 'Beta'
        }
      ]
    })
  })

  it('stickyGroups: true in non-windowed mode applies position: sticky CSS', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const div = createMockElement('div')
        div.text = item.name
        return div
      },
      groupBy: (item) => item.group,
      createHeader: (groupKey) => {
        const h = createMockElement('header')
        h.text = groupKey
        return h
      },
      stickyGroups: true
    })

    const headers = container.children.filter((c) => c.hasAttribute('data-lists-header'))
    assert.equal(headers.length, 2)

    assert.equal(headers[0].style.position, 'sticky')
    assert.equal(headers[0].style.top, '0px')
    assert.equal(headers[0].style.zIndex, '1')

    assert.equal(headers[1].style.position, 'sticky')
    assert.equal(headers[1].style.top, '0px')
    assert.equal(headers[1].style.zIndex, '1')
  })

  it('stickyGroups: false renders inline headers without position: sticky', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const div = createMockElement('div')
        div.text = item.name
        return div
      },
      groupBy: (item) => item.group,
      createHeader: (groupKey) => {
        const h = createMockElement('header')
        h.text = groupKey
        return h
      },
      stickyGroups: false
    })

    const headers = container.children.filter((c) => c.hasAttribute('data-lists-header'))
    assert.equal(headers.length, 2)
    assert.equal(headers[0].style.position, undefined)
  })

  it('stickyGroups: true in virtual: "window" mode creates JS sticky header element', () => {
    const handle = bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const div = createMockElement('div')
        div.text = item.name
        return div
      },
      groupBy: (item) => item.group,
      createHeader: (groupKey) => {
        const h = createMockElement('header')
        h.text = groupKey
        return h
      },
      stickyGroups: true,
      virtual: 'window'
    })

    const stickyHeader = container.children.find((c) => c.getAttribute('class') === 'lists-sticky-header')
    assert.ok(stickyHeader)
    assert.equal(stickyHeader.style.position, 'absolute')
    assert.equal(stickyHeader.style.top, '0px')
    assert.equal(stickyHeader.style.zIndex, '1')

    handle.destroy()
    assert.equal(container.children.includes(stickyHeader), false)
  })
})
