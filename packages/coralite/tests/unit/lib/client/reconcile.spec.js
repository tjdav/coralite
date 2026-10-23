/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'
import { applyListPattern, detectListPattern } from '../../../../lib/utils/observer-record.js'

describe('Reconcile List Patterns', () => {
  describe('applyListPattern', () => {
    function createContainer (labels) {
      const container = document.createElement('ul')
      labels.forEach((label) => {
        const li = document.createElement('li')
        li.textContent = label
        container.appendChild(li)
      })
      return {
        container,
        element: {
          firstElementChild: container
        }
      }
    }

    function getChildTexts (container) {
      return Array.from(container.children).map((child) => child.textContent)
    }

    it('adjacent swap (i > j) reorders correctly', () => {
      const { container, element } = createContainer(['A', 'B', 'C'])
      const applied = applyListPattern(element, 'items', {
        type: 'swap',
        i: 2,
        j: 1
      })
      assert.strictEqual(applied, true)
      assert.deepStrictEqual(getChildTexts(container), ['A', 'C', 'B'])
    })

    it('adjacent swap (i < j) still works', () => {
      const { container, element } = createContainer(['A', 'B', 'C'])
      const applied = applyListPattern(element, 'items', {
        type: 'swap',
        i: 0,
        j: 1
      })
      assert.strictEqual(applied, true)
      assert.deepStrictEqual(getChildTexts(container), ['B', 'A', 'C'])
    })

    it('non-adjacent swap still works', () => {
      const { container, element } = createContainer(['A', 'B', 'C', 'D'])
      const applied = applyListPattern(element, 'items', {
        type: 'swap',
        i: 0,
        j: 3
      })
      assert.strictEqual(applied, true)
      assert.deepStrictEqual(getChildTexts(container), ['D', 'B', 'C', 'A'])
    })
  })

  describe('detectListPattern', () => {
    it('should return null for non-array inputs', () => {
      assert.strictEqual(detectListPattern(null, []), null)
      assert.strictEqual(detectListPattern([], null), null)
      assert.strictEqual(detectListPattern('abc', 'def'), null)
    })

    it('should detect swap of two items', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      const newList = [{ id: 1 }, { id: 3 }, { id: 2 }, { id: 4 }]
      const result = detectListPattern(oldList, newList)
      assert.deepStrictEqual(result, {
        type: 'swap',
        i: 1,
        j: 2
      })
    })

    it('should return null for swap where items differ by more than 2', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      const newList = [{ id: 3 }, { id: 1 }, { id: 2 }, { id: 4 }]
      assert.strictEqual(detectListPattern(oldList, newList), null)
    })

    it('should return null if 2 items differ but do not exchange keys', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const newList = [{ id: 1 }, { id: 4 }, { id: 3 }]
      assert.strictEqual(detectListPattern(oldList, newList), null)
    })

    it('should detect single removal in the middle', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      const newList = [{ id: 1 }, { id: 3 }, { id: 4 }]
      const result = detectListPattern(oldList, newList)
      assert.deepStrictEqual(result, {
        type: 'remove',
        index: 1
      })
    })

    it('should detect single removal at the end', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const newList = [{ id: 1 }, { id: 2 }]
      const result = detectListPattern(oldList, newList)
      assert.deepStrictEqual(result, {
        type: 'remove',
        index: 2
      })
    })

    it('should return null for multi-removal', () => {
      const oldList = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
      const newList = [{ id: 1 }, { id: 4 }]
      assert.strictEqual(detectListPattern(oldList, newList), null)
    })
  })

  describe('Component Reconcile Integration', () => {
    function createTestComponent (reconcileMode) {
      const tagName = 'test-reconcile-' + Math.random().toString(36).substring(2, 9)
      const ComponentClass = createCoraliteClass({
        componentId: tagName,
        reconcile: reconcileMode,
        defaultValues: {
          items: [
            {
              id: 1,
              text: 'First'
            },
            {
              id: 2,
              text: 'Second'
            },
            {
              id: 3,
              text: 'Third'
            }
          ]
        },
        templateHTML: '<div ref="list"><div class="row" data-id="1">First</div><div class="row" data-id="2">Second</div><div class="row" data-id="3">Third</div></div>',
        hydrationMap: {
          refs: [{ name: 'list' }]
        },
        client ({ state, observe }) {
          state.observerCount = 0
          observe('items', () => {
            state.observerCount++
          })
        }
      })
      customElements.define(tagName, ComponentClass)
      const el = document.createElement(tagName)
      document.body.appendChild(el)
      return el
    }

    it('reconcile: minimal - swap of two items moves existing DOM nodes and preserves identity', async () => {
      const el = createTestComponent('minimal')
      await el.updateComplete

      const listContainer = el.querySelector('[ref="list"]') || el.firstElementChild
      const firstNodeBefore = listContainer.children[0]
      const secondNodeBefore = listContainer.children[1]

      // Attach state property onto second node to verify node identity/state preservation
      secondNodeBefore._customState = 'preserved-data'

      // Perform swap of items 0 and 1
      const currentItems = el._state.items
      el._state.items = [currentItems[1], currentItems[0], currentItems[2]]

      await el.updateComplete

      // Verify DOM move
      assert.strictEqual(listContainer.children[0], secondNodeBefore)
      assert.strictEqual(listContainer.children[1], firstNodeBefore)
      assert.strictEqual(listContainer.children[0]._customState, 'preserved-data')

      // Verify observer callback was NOT called
      assert.strictEqual(el._state.observerCount, 0)

      el.remove()
    })

    it('reconcile: minimal - single removal removes one DOM node and bypasses observer', async () => {
      const el = createTestComponent('minimal')
      await el.updateComplete

      const listContainer = el.querySelector('[ref="list"]') || el.firstElementChild
      assert.strictEqual(listContainer.children.length, 3)

      const currentItems = el._state.items
      // Remove second item (index 1)
      el._state.items = [currentItems[0], currentItems[2]]

      await el.updateComplete

      assert.strictEqual(listContainer.children.length, 2)
      assert.strictEqual(listContainer.children[0].getAttribute('data-id'), '1')
      assert.strictEqual(listContainer.children[1].getAttribute('data-id'), '3')

      // Observer was NOT invoked
      assert.strictEqual(el._state.observerCount, 0)

      el.remove()
    })

    it('reconcile: minimal - non-swap / fallback change invokes observer callback', async () => {
      const el = createTestComponent('minimal')
      await el.updateComplete

      // Replace with completely new set
      el._state.items = [
        {
          id: 10,
          text: 'New 1'
        },
        {
          id: 20,
          text: 'New 2'
        },
        {
          id: 30,
          text: 'New 3'
        }
      ]

      await el.updateComplete

      // Observer callback fired
      assert.strictEqual(el._state.observerCount, 1)

      el.remove()
    })

    it('reconcile: minimal - multi-removal invokes observer callback', async () => {
      const el = createTestComponent('minimal')
      await el.updateComplete

      const currentItems = el._state.items
      // Remove 2 items
      el._state.items = [currentItems[0]]

      await el.updateComplete

      // Observer callback fired
      assert.strictEqual(el._state.observerCount, 1)

      el.remove()
    })

    it('reconcile: full (default) - observer fires for every change', async () => {
      const el = createTestComponent('full')
      await el.updateComplete

      const currentItems = el._state.items
      el._state.items = [currentItems[1], currentItems[0], currentItems[2]]

      await el.updateComplete

      // Under full, observer always fires
      assert.strictEqual(el._state.observerCount, 1)

      el.remove()
    })
  })
})
