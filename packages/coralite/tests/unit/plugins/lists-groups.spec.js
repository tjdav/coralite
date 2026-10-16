import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'
import { groupItems, findTopVisibleGroup } from '../../../plugins/lists/groups.js'

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

describe('lists plugin - groups', () => {
  let container
  let store

  beforeEach(() => {
    container = createMockElement('ul')
    store = createStore({
      key: (item) => item.id,
      initial: [
        {
          id: '1',
          name: 'Apple',
          category: 'Fruit'
        },
        {
          id: '2',
          name: 'Carrot',
          category: 'Vegetable'
        },
        {
          id: '3',
          name: 'Banana',
          category: 'Fruit'
        },
        {
          id: '4',
          name: 'Water',
          category: null
        },
        {
          id: '5',
          name: 'Broccoli',
          category: 'Vegetable'
        }
      ]
    })
  })

  it('groupItems groups items by returning string key and preserves first-appearance order', () => {
    const raw = store.all()
    const { flatItems, groups } = groupItems(raw, (item) => item.category)

    assert.equal(groups.length, 2)
    assert.equal(groups[0].groupKey, 'Fruit')
    assert.equal(groups[1].groupKey, 'Vegetable')

    assert.equal(groups[0].items.length, 2)
    assert.equal(groups[0].items[0].name, 'Apple')
    assert.equal(groups[0].items[1].name, 'Banana')

    assert.equal(groups[1].items.length, 2)
    assert.equal(groups[1].items[0].name, 'Carrot')
    assert.equal(groups[1].items[1].name, 'Broccoli')

    // flatItems has 2 headers + 4 grouped items + 1 ungrouped item = 7 items
    assert.equal(flatItems.length, 7)
    assert.equal(flatItems[0].key, '__header__Fruit')
    assert.equal(flatItems[1].name, 'Apple')
    assert.equal(flatItems[2].name, 'Banana')
    assert.equal(flatItems[3].key, '__header__Vegetable')
    assert.equal(flatItems[4].name, 'Carrot')
    assert.equal(flatItems[5].name, 'Broccoli')
    // null category at end
    assert.equal(flatItems[6].name, 'Water')
  })

  it('renders group headers in DOM using createHeader', () => {
    const createdHeaders = []

    bind({
      container,
      store,
      key: (i) => i.id,
      create: (item) => {
        const li = createMockElement('li')
        li.text = item.name
        return li
      },
      groupBy: (item) => item.category,
      createHeader: (groupKey, groupItemsList) => {
        createdHeaders.push(groupKey)
        const header = createMockElement('h3')
        header.text = `${groupKey} (${groupItemsList.length})`
        return header
      }
    })

    assert.deepEqual(createdHeaders, ['Fruit', 'Vegetable'])
    assert.equal(container.children.length, 7)

    // Header 1
    assert.equal(container.children[0].tagName, 'H3')
    assert.equal(container.children[0].text, 'Fruit (2)')
    assert.equal(container.children[0].hasAttribute('data-lists-header'), true)

    // Fruit items
    assert.equal(container.children[1].text, 'Apple')
    assert.equal(container.children[2].text, 'Banana')

    // Header 2
    assert.equal(container.children[3].tagName, 'H3')
    assert.equal(container.children[3].text, 'Vegetable (2)')

    // Vegetable items
    assert.equal(container.children[4].text, 'Carrot')
    assert.equal(container.children[5].text, 'Broccoli')

    // Ungrouped item
    assert.equal(container.children[6].text, 'Water')
  })

  it('findTopVisibleGroup returns active group based on virtualScrollTop', () => {
    const raw = store.all()
    const { groups } = groupItems(raw, (item) => item.category)

    const positions = [
      {
        key: '__header__Fruit',
        y: 0,
        height: 40
      },
      {
        key: '1',
        y: 40,
        height: 60
      },
      {
        key: '3',
        y: 100,
        height: 60
      },
      {
        key: '__header__Vegetable',
        y: 160,
        height: 40
      },
      {
        key: '2',
        y: 200,
        height: 60
      },
      {
        key: '5',
        y: 260,
        height: 60
      }
    ]

    const group1 = findTopVisibleGroup(groups, positions, 0)
    assert.equal(group1.groupKey, 'Fruit')
    assert.equal(group1.nextGroupTop, 160)

    const group2 = findTopVisibleGroup(groups, positions, 160)
    assert.equal(group2.groupKey, 'Vegetable')
  })
})
