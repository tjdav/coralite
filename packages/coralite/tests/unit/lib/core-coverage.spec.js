import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  mergePluginState,
  createReactiveProxy,
  createReadOnlyProxy,
  getNodePath,
  generateHydrationMap,
  addComponentAndDependencies,
  cleanAST,
  cleanValues
} from '../../../lib/utils/core.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('core.js Coverage Gaps', () => {
  describe('mergePluginState', () => {
    it('should handle non-object patch', () => {
      assert.deepStrictEqual(mergePluginState({ a: 1 }, null), { a: 1 })
      assert.deepStrictEqual(mergePluginState({ a: 1 }, 'string'), { a: 1 })
    })

    it('should overwrite arrays', () => {
      const current = { list: [1] }
      const patch = { list: [2] }
      const result = mergePluginState(current, patch)
      assert.deepStrictEqual(result.list, [2])
    })
  })

  describe('createReactiveProxy', () => {
    it('should handle circular references', () => {
      const target = { a: 1 }
      target.self = target
      const proxy = createReactiveProxy(target, () => {
      })
      assert.strictEqual(proxy.self, proxy)
    })

    it('should handle deleteProperty', () => {
      let changed = false
      const target = { a: 1 }
      const proxy = createReactiveProxy(target, () => {
        changed = true
      })
      delete proxy.a
      assert.strictEqual(changed, true)
      assert.ok(!('a' in target))
    })

    it('should not trigger onChange if value is same', () => {
      let changed = false
      const target = { a: 1 }
      const proxy = createReactiveProxy(target, () => {
        changed = true
      })
      proxy.a = 1
      assert.strictEqual(changed, false)
    })
  })

  describe('createReadOnlyProxy', () => {
    it('should throw on deleteProperty', () => {
      const proxy = createReadOnlyProxy({ a: 1 })
      assert.throws(() => {
        delete proxy.a
      }, CoraliteError)
    })

    it('should handle circular references', () => {
      const target = { a: 1 }
      target.self = target
      const proxy = createReadOnlyProxy(target)
      assert.strictEqual(proxy.self, proxy)
    })
  })

  describe('getNodePath', () => {
    it('should return empty path if node is root', () => {
      const node = { type: 'root' }
      assert.deepStrictEqual(getNodePath(node, node), [])
    })

    it('should return empty path if no parent', () => {
      const node = { type: 'tag' }
      assert.deepStrictEqual(getNodePath(node, { type: 'root' }), [])
    })

    it('should handle node not in parent children (should not happen in well-formed AST)', () => {
      const parent = { children: [] }
      const node = { parent }
      assert.deepStrictEqual(getNodePath(node, { type: 'root' }), [])
    })
  })

  describe('generateHydrationMap', () => {
    it('should return empty map for missing inputs', () => {
      assert.deepStrictEqual(generateHydrationMap(null, null), {
        texts: [],
        attributes: [],
        refs: []
      })
    })

    it('should handle html type in textNodes', () => {
      const textNode = {
        type: 'text',
        data: '{{val}}'
      }
      const parent = {
        type: 'tag',
        children: [textNode]
      }
      textNode.parent = parent
      const templateNodes = [parent]
      const templateValues = {
        textNodes: [{
          type: 'html',
          textNode
        }]
      }
      const map = generateHydrationMap(templateNodes, templateValues)
      assert.strictEqual(map.texts[0].type, 'html')
      assert.deepStrictEqual(map.texts[0].path, [])
    })

    it('should handle empty templateNodes', () => {
      const map = generateHydrationMap([], { textNodes: [] })
      assert.deepStrictEqual(map.texts, [])
    })
  })

  describe('addComponentAndDependencies', () => {
    it('should handle missing dependencies', () => {
      const processed = {}
      const sharedFunctions = {
        'comp-1': {}
      }
      addComponentAndDependencies('comp-1', processed, sharedFunctions)
      assert.ok(processed['comp-1'])
    })
  })

  describe('cleanAST', () => {
    it('should return null for missing nodes', () => {
      assert.strictEqual(cleanAST(null, new WeakMap(), {}), null)
    })
  })

  describe('cleanValues', () => {
    it('should return null for missing values', () => {
      assert.strictEqual(cleanValues(null, new WeakMap()), null)
    })

    it('should handle refs', () => {
      const node = { type: 'tag' }
      const nodeMap = new WeakMap()
      nodeMap.set(node, 123)
      const values = {
        refs: [{
          name: 'myRef',
          element: node
        }]
      }
      const cleaned = cleanValues(values, nodeMap)
      assert.strictEqual(cleaned.refs[0].elementId, 123)
      assert.strictEqual(cleaned.refs[0].element, undefined)
    })
  })
})
