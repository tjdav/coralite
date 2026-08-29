import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { freezeTemplate, compileOps } from '../../../lib/utils/server/fragment.js'

describe('Fragment-Op SSR Renderer Unit Tests', () => {
  describe('freezeTemplate', () => {
    it('should deeply freeze component metadata dictionaries without freezing DOM AST nodes', () => {
      const parent = { type: 'tag', name: 'div', children: [] }
      const child = { type: 'text', data: 'hello', parent }
      parent.children.push(child)

      const moduleMock = {
        template: parent,
        values: {
          textNodes: [{ textNode: child, tokens: [{ name: 'val', content: '{{ val }}' }] }],
          attributes: [],
          refs: []
        },
        customElements: [{ name: 'child-comp' }],
        slotElements: {}
      }

      const frozen = freezeTemplate(moduleMock)

      // Metadata dictionaries must be frozen
      assert.strictEqual(Object.isFrozen(frozen.values), true)
      assert.strictEqual(Object.isFrozen(frozen.values.textNodes), true)
      assert.strictEqual(Object.isFrozen(frozen.customElements), true)
      assert.strictEqual(Object.isFrozen(frozen.slotElements), true)

      // DOM AST nodes must NOT be frozen (to allow dom-serializer SVG name normalization)
      assert.strictEqual(Object.isFrozen(frozen.template), false)
      assert.strictEqual(Object.isFrozen(child), false)
    })
  })

  describe('capability cascade and cycle detection', () => {
    it('should recursively evaluate capability for depth-3 component tree (A -> B -> C)', async () => {
      const { checkComponentCapability } = await import('../../../lib/utils/server/fragment.js')

      const compC = { id: 'comp-c', template: { children: [{ type: 'text', data: 'C' }] }, customElements: [] }
      const compB = { id: 'comp-b', template: { children: [{ type: 'tag', name: 'comp-c', children: [] }] }, customElements: [{ name: 'comp-c' }] }
      const compA = { id: 'comp-a', template: { children: [{ type: 'tag', name: 'comp-b', children: [] }] }, customElements: [{ name: 'comp-b' }] }

      const appMock = {
        components: {
          getItem (name) {
            if (name === 'comp-c') return { result: compC }
            if (name === 'comp-b') return { result: compB }
            if (name === 'comp-a') return { result: compA }
            return null
          }
        }
      }

      const memo = new Map()
      const capable = checkComponentCapability(compA, appMock, memo)
      assert.strictEqual(capable, true)
      assert.strictEqual(compA.__opsCapable, true)
      assert.strictEqual(compB.__opsCapable, true)
      assert.strictEqual(compC.__opsCapable, true)
    })

    it('should detect cycles (A -> B -> A) and mark components as not opsCapable', async () => {
      const { checkComponentCapability } = await import('../../../lib/utils/server/fragment.js')

      const compB = { id: 'comp-b', template: { children: [] }, customElements: [{ name: 'comp-a' }] }
      const compA = { id: 'comp-a', template: { children: [] }, customElements: [{ name: 'comp-b' }] }

      const appMock = {
        components: {
          getItem (name) {
            if (name === 'comp-a') return { result: compA }
            if (name === 'comp-b') return { result: compB }
            return null
          }
        }
      }

      const memo = new Map()
      const capable = checkComponentCapability(compA, appMock, memo)
      assert.strictEqual(capable, false)
      assert.strictEqual(compA.__opsCapable, false)
    })
  })

  describe('compileOps', () => {
    it('should compile static template subtrees into str ops', () => {
      const mockComponent = {
        template: {
          children: [
            { type: 'tag', name: 'div', attribs: { class: 'container' }, children: [
              { type: 'text', data: 'Static Content' }
            ]}
          ]
        },
        values: {},
        customElements: []
      }

      const appMock = { components: { getItem: () => null } }
      const { ops, opsCapable } = compileOps(mockComponent, appMock)

      assert.strictEqual(opsCapable, true)
      assert.strictEqual(ops.length, 1)
      assert.strictEqual(ops[0].t, 'str')
      assert.strictEqual(ops[0].s, '<div class="container">Static Content</div>')
    })

    it('should identify dynamic text nodes and emit text ops with surrounding static text', () => {
      const textNodeObj = { type: 'text', data: 'Hello {{ name }}!' }
      const mockComponent = {
        template: {
          children: [textNodeObj]
        },
        values: {
          textNodes: [
            {
              textNode: textNodeObj,
              tokens: [{ name: 'name', content: '{{ name }}' }]
            }
          ]
        },
        customElements: []
      }

      const appMock = { components: { getItem: () => null } }
      const { ops, opsCapable } = compileOps(mockComponent, appMock)

      assert.strictEqual(opsCapable, true)
      assert.strictEqual(ops.length, 3)
      assert.strictEqual(ops[0].t, 'str')
      assert.strictEqual(ops[0].s, 'Hello ')
      assert.strictEqual(ops[1].t, 'text')
      assert.strictEqual(ops[1].name, 'name')
      assert.strictEqual(ops[1].content, '{{ name }}')
      assert.strictEqual(ops[2].t, 'str')
      assert.strictEqual(ops[2].s, '!')
    })

    it('should gate components with slots as not opsCapable', () => {
      const mockComponent = {
        template: { children: [] },
        slotElements: { default: {} }
      }
      const appMock = { components: { getItem: () => null } }
      const { opsCapable } = compileOps(mockComponent, appMock)

      assert.strictEqual(opsCapable, false)
    })

    it('should gate components with no-hydration in template as not opsCapable', () => {
      const mockComponent = {
        template: {
          children: [
            { type: 'tag', name: 'div', attribs: { 'no-hydration': '' }, children: [] }
          ]
        }
      }
      const appMock = { components: { getItem: () => null } }
      const { opsCapable } = compileOps(mockComponent, appMock)

      assert.strictEqual(opsCapable, false)
    })

    it('should gate components with uncapable child custom elements', () => {
      const customEl = { type: 'tag', name: 'child-comp', attribs: {}, children: [] }
      const mockComponent = {
        template: { children: [customEl] },
        customElements: [customEl]
      }

      const appMock = {
        components: {
          getItem: (name) => {
            if (name === 'child-comp') {
              return { result: { __opsCapable: false } }
            }
            return null
          }
        }
      }

      const { opsCapable } = compileOps(mockComponent, appMock)
      assert.strictEqual(opsCapable, false)
    })
  })
})
