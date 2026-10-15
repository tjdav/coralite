
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

// Simple mock DOM environment for node test environment
function createMockElement (tagName = 'div') {
  const children = []
  const attributes = new Map()

  return {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
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

// Global document mock if not in browser environment
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

describe('lists plugin - bind', () => {
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

  it('renders initial store items on bind', () => {
    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.setAttribute('data-id', item.id)
        li.text = item.text
        return li
      }
    })

    assert.equal(container.children.length, 2)
    assert.equal(container.children[0].text, 'One')
    assert.equal(container.children[1].text, 'Two')
  })

  it('reacts to append and prepend', () => {
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

    store.append({
      id: '3',
      text: 'Three'
    })
    assert.equal(container.children.length, 3)
    assert.equal(container.children[2].text, 'Three')

    store.prepend({
      id: '0',
      text: 'Zero'
    })
    assert.equal(container.children.length, 4)
    assert.equal(container.children[0].text, 'Zero')
  })

  it('calls update callback on store update', () => {
    let updateCalls = 0
    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      },
      update: (el, item) => {
        updateCalls++
        el.text = item.text
      }
    })

    store.update('1', { text: 'One Updated' })

    assert.equal(updateCalls, 1)
    assert.equal(container.children[0].text, 'One Updated')
  })

  it('works without update option during append and remove', () => {
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

    store.append({
      id: '3',
      text: 'Three'
    })
    assert.equal(container.children.length, 3)

    store.remove('1')
    assert.equal(container.children.length, 2)
    assert.equal(container.children[0].text, 'Two')
  })

  it('removes DOM element on store.remove', () => {
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

    store.remove('1')
    assert.equal(container.children.length, 1)
    assert.equal(container.children[0].text, 'Two')
  })

  it('re-renders on store.set and clears on store.clear', () => {
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

    store.set([
      {
        id: '10',
        text: 'Ten'
      }
    ])
    assert.equal(container.children.length, 1)
    assert.equal(container.children[0].text, 'Ten')

    store.clear()
    assert.equal(container.children.length, 0)
  })

  it('handle.destroy stops listening without clearing DOM', () => {
    const handle = bind({
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

    handle.destroy()

    store.append({
      id: '3',
      text: 'Three'
    })
    // Container remains unchanged at 2 items after destroy
    assert.equal(container.children.length, 2)
  })

  it('auto-destroys when AbortSignal is aborted', () => {
    const controller = new AbortController()

    bind({
      container,
      store,
      signal: controller.signal,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    assert.equal(container.children.length, 2)

    controller.abort()

    store.append({
      id: '3',
      text: 'Three'
    })
    assert.equal(container.children.length, 2)
  })

  it('supports independent multiple bindings to the same store', () => {
    const container1 = createMockElement('ul')
    const container2 = createMockElement('ol')

    const handle1 = bind({
      container: container1,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.text
        return li
      }
    })

    bind({
      container: container2,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = `2: ${item.text}`
        return li
      }
    })

    assert.equal(container1.children.length, 2)
    assert.equal(container2.children.length, 2)

    store.append({
      id: '3',
      text: 'Three'
    })
    assert.equal(container1.children.length, 3)
    assert.equal(container2.children.length, 3)

    handle1.destroy()

    store.append({
      id: '4',
      text: 'Four'
    })
    // Container 1 stopped at 3 items, Container 2 continued to 4
    assert.equal(container1.children.length, 3)
    assert.equal(container2.children.length, 4)
  })

  it('throws CoraliteError when unsupported options are passed', () => {
    const opts = {
      container,
      store,
      key: (i) => i.id,
      create: (_item) => createMockElement('li')
    }

    assert.throws(
      () => bind({
        ...opts,
        virtual: 'window'
      }),
      /virtual: "window" is not yet implemented/
    )

    assert.throws(
      () => bind({
        ...opts,
        direction: 'row'
      }),
      /Direction configuration is not yet supported/
    )

    assert.throws(
      () => bind({
        ...opts,
        groupBy: 'category'
      }),
      /Grouping \(groupBy\) is not yet supported/
    )

    assert.throws(
      () => bind({
        ...opts,
        onReachEnd: () => {
        }
      }),
      /Infinite scroll callbacks/
    )
  })
})
