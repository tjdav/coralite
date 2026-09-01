import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  cleanKeys,
  mergePluginState,
  createReactiveProxy,
  createReadOnlyProxy,
  getNodePath,
  generateHydrationMap,
  addComponentAndDependencies,
  cleanAST,
  cleanValues,
  stripCssComments
} from '../../../lib/utils/core.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('core.js Coverage Gaps', () => {
  describe('cleanKeys', () => {
    it('should return empty object when given an empty object', () => {
      const input = {}
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, {})
      assert.notStrictEqual(result, input)
    })

    it('should preserve plain and camelCase keys without duplicate alias properties', () => {
      const input = { foo: 'bar', bazQux: 123 }
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, { foo: 'bar', bazQux: 123 })
      assert.strictEqual(Object.keys(result).length, 2)
    })

    it('should convert single kebab-case key to camelCase while retaining original key', () => {
      const input = { 'foo-bar': 'value' }
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, {
        'foo-bar': 'value',
        fooBar: 'value'
      })
    })

    it('should convert multi-dash kebab-case keys to camelCase', () => {
      const input = { 'data-user-id': 42 }
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, {
        'data-user-id': 42,
        dataUserId: 42
      })
    })

    it('should convert colon-separated keys to camelCase', () => {
      const input = { 'xml:lang': 'en' }
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, {
        'xml:lang': 'en',
        xmlLang: 'en'
      })
    })

    it('should handle mixed objects with kebab-case, colons, camelCase, and plain keys', () => {
      const objVal = { nested: true }
      const input = {
        'attr-one': 'a',
        'xml:base': 'b',
        alreadyCamel: 'c',
        plain: 'd',
        'complex-obj': objVal
      }
      const result = cleanKeys(input)
      assert.deepStrictEqual(result, {
        'attr-one': 'a',
        attrOne: 'a',
        'xml:base': 'b',
        xmlBase: 'b',
        alreadyCamel: 'c',
        plain: 'd',
        'complex-obj': objVal,
        complexObj: objVal
      })
      assert.strictEqual(result.complexObj, objVal)
    })
  })

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

    it('should return raw item object on array element read without proxy wrapping', () => {
      const item = { id: 1, label: 'test' }
      const target = { data: [item] }
      const proxy = createReactiveProxy(target, () => {})
      const readItem = proxy.data[0]
      assert.strictEqual(readItem, item)
    })

    it('should maintain reactivity on array mutations and reassignments', () => {
      const changes = []
      const target = { data: [{ id: 1 }] }
      const proxy = createReactiveProxy(target, change => {
        changes.push(change)
      })

      proxy.data.push({ id: 2 })
      assert.ok(changes.length > 0)

      changes.length = 0
      proxy.data[0] = { id: 99 }
      assert.strictEqual(changes.length, 1)
      assert.strictEqual(changes[0].property, '0')

      changes.length = 0
      proxy.data = [{ id: 100 }]
      assert.strictEqual(changes.length, 1)
      assert.strictEqual(changes[0].property, 'data')
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

    it('should return raw item object on array element read without proxy wrapping', () => {
      const item = { id: 1, label: 'test' }
      const target = { data: [item] }
      const proxy = createReadOnlyProxy(target)
      const readItem = proxy.data[0]
      assert.strictEqual(readItem, item)
    })

    it('should invoke tracker activeCollector on array property read', () => {
      const collected = []
      const tracker = {
        activeCollector (prop) {
          collected.push(prop)
        }
      }
      const item = { id: 10 }
      const target = { data: [item] }
      const proxy = createReadOnlyProxy(target, new WeakMap(), tracker)

      const readItem = proxy.data[0]
      assert.strictEqual(readItem, item)
      assert.deepStrictEqual(collected, ['data', '0'])
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

  describe('stripCssComments', () => {
    it('should return empty string for null, undefined, empty, or non-string inputs', () => {
      assert.strictEqual(stripCssComments(null), '')
      assert.strictEqual(stripCssComments(undefined), '')
      assert.strictEqual(stripCssComments(''), '')
      // @ts-ignore
      assert.strictEqual(stripCssComments(123), '')
      // @ts-ignore
      assert.strictEqual(stripCssComments({}), '')
    })

    it('should strip single block comments', () => {
      const input = '/* comment */ .btn { color: red; }'
      assert.strictEqual(stripCssComments(input), ' .btn { color: red; }')
    })

    it('should strip multiple comments on a single line', () => {
      const input = '/* c1 */ .foo { color: red; } /* c2 */ .bar { color: blue; } /* c3 */'
      assert.strictEqual(stripCssComments(input), ' .foo { color: red; }  .bar { color: blue; } ')
    })

    it('should strip multi-line comments spanning newlines', () => {
      const input = `
        /**
         * Multi-line header comment
         * [ref="btnApply"]
         */
        .card { padding: 1rem; }
      `
      const result = stripCssComments(input)
      assert.strictEqual(result.includes('Multi-line header comment'), false)
      assert.strictEqual(result.includes('[ref="btnApply"]'), false)
      assert.strictEqual(result.includes('.card { padding: 1rem; }'), true)
    })

    it('should swallow unterminated/unclosed comments to EOF per CSS Syntax Level 3', () => {
      const input = '.btn { color: red; } /* unclosed comment [ref="btnApply"]'
      const result = stripCssComments(input)
      assert.strictEqual(result, '.btn { color: red; } ')
    })

    it('should preserve universal selector and division operator slashes', () => {
      const input = '* { margin: 0; } .box { width: calc(100% / 2); }'
      assert.strictEqual(stripCssComments(input), input)
    })

    it('should process large adversarial repetitive comment starters in linear time', () => {
      const payload = '/* a/* a/* a/* a/* '.repeat(10000) + '*/ .target { color: green; }'
      const result = stripCssComments(payload)
      assert.strictEqual(result, ' .target { color: green; }')
    })
  })
})

