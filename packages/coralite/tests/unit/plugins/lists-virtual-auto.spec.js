import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'
import { CoraliteError } from '../../../lib/shared/errors.js'

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

function createMockFragment () {
  const children = []
  return {
    type: 'fragment',
    children,
    appendChild (child) {
      children.push(child)
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

describe('lists plugin - virtual: auto', () => {
  let container
  let store

  beforeEach(() => {
    container = createMockElement('ul')
    store = createStore({
      key: (item) => item.id,
      initial: [
        {
          id: '1',
          text: 'One'
        },
        {
          id: '2',
          text: 'Two'
        }
      ]
    })
  })

  it('bind with no virtual option or virtual: false behaves as P4.09a', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.children.length, 2)
    assert.equal(container.style.contain, undefined)
    assert.equal(container.children[0].style.contentVisibility, undefined)
  })

  it('bind with virtual: "auto" adds contain: layout style to container and content-visibility to rows', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'auto',
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.style.contain, 'layout style')
    assert.equal(container.children[0].style.contentVisibility, 'auto')
    assert.equal(container.children[0].style.containIntrinsicSize, 'auto 64px')
    assert.equal(container.children[1].style.contentVisibility, 'auto')
    assert.equal(container.children[1].style.containIntrinsicSize, 'auto 64px')
  })

  it('bind with virtual: "auto" and numeric size uses specified size in px', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'auto',
      size: 100,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.children[0].style.containIntrinsicSize, 'auto 100px')
  })

  it('bind with virtual: "auto" and size: "measure" falls back to 64px', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'auto',
      size: 'measure',
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.children[0].style.containIntrinsicSize, 'auto 64px')
  })

  it('rows added after bind (via store.append/prepend) also receive row styles', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'auto',
      size: 80,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    store.append({
      id: '3',
      text: 'Three'
    })
    store.prepend({
      id: '0',
      text: 'Zero'
    })

    assert.equal(container.children.length, 4)
    assert.equal(container.children[0].style.contentVisibility, 'auto')
    assert.equal(container.children[0].style.containIntrinsicSize, 'auto 80px')
    assert.equal(container.children[3].style.contentVisibility, 'auto')
    assert.equal(container.children[3].style.containIntrinsicSize, 'auto 80px')
  })

  it('handle.destroy() removes container contain style and row styles', () => {
    const handle = bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'auto',
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.style.contain, 'layout style')
    assert.equal(container.children[0].style.contentVisibility, 'auto')

    handle.destroy()

    assert.equal(container.style.contain, '')
    assert.equal(container.children[0].style.contentVisibility, '')
    assert.equal(container.children[0].style.containIntrinsicSize, '')
  })

  it('bind with virtual: "window" delegates to windowed virtualization engine', () => {
    const handle = bind({
      container,
      store,
      key: (i) => i.id,
      virtual: 'window',
      create: (_item) => createMockElement('li')
    })

    assert.ok(handle)
    assert.equal(typeof handle.destroy, 'function')
    handle.destroy()
  })

  it('bind with an invalid virtual option throws CoraliteError', () => {
    assert.throws(
      () => bind({
        container,
        store,
        key: (i) => i.id,
        virtual: 'invalid-mode',
        create: (_item) => createMockElement('li')
      }),
      (err) => {
        return err instanceof CoraliteError && err.message.includes('invalid virtual option')
      }
    )
  })

  it('logs console.warn in development mode when container has no visible overflow', () => {
    const originalWindow = globalThis.window
    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)

    try {
      globalThis.window = {
        getComputedStyle: () => ({ overflow: 'visible' })
      }

      bind({
        container,
        store,
        key: (i) => i.id,
        virtual: 'auto',
        create: (item) => {
          const li = createMockElement('li')
          li.text = item.text
          return li
        }
      })

      assert.equal(warnings.length, 1)
      assert.match(warnings[0], /Container does not have scrollable overflow/)
    } finally {
      console.warn = originalWarn
      globalThis.window = originalWindow
    }
  })
})
