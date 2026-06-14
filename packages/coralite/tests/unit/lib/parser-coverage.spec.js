import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { processTokenValue } from '../../../lib/parser.js'
import { createCoraliteTextNode } from '../../../lib/utils/server/dom.js'

describe('parser.js Coverage Gaps', () => {
  describe('processTokenValue', () => {
    it('should return non-string values as-is', async () => {
      assert.strictEqual(await processTokenValue(123, {}), 123)
      assert.strictEqual(await processTokenValue(null, {}), null)
    })

    it('should return undefined for empty HTML strings', async () => {
      assert.strictEqual(await processTokenValue('', {}), undefined)
      // '   ' will be parsed as a text node by htmlparser2, but processTokenValue
      // might return it as a string if it's a single text node.
    })

    it('should process custom elements and apply hydration', async () => {
      const state = {}
      const module = { path: { pathname: '/test.html' } }
      const session = { componentTags: new Set() }

      const createComponentElement = async () => {
        return {
          children: [createCoraliteTextNode({ data: 'component content' })]
        }
      }

      const value = '<my-comp></my-comp>'
      const result = await processTokenValue(value, {
        state,
        module,
        session,
        createComponentElement,
        noHydration: false
      })

      assert.ok(Array.isArray(result))
      const customEl = result[0]
      assert.strictEqual(customEl.name, 'my-comp')
      assert.strictEqual(customEl.children[0].data, 'component content')
      assert.strictEqual(customEl.attribs['data-cid'], '/test.htmlmy-comp-0')
      assert.ok(session.componentTags.has('my-comp'))
    })

    it('should process custom elements with no-hydration', async () => {
      const state = {}
      const module = { path: { pathname: '/test.html' } }
      const session = { componentTags: new Set() }

      const createComponentElement = async () => {
        return {
          children: [createCoraliteTextNode({ data: 'static content' })]
        }
      }

      // no-hydration via attribute
      const value = '<div><my-comp no-hydration></my-comp></div>'
      const result = await processTokenValue(value, {
        state,
        module,
        session,
        createComponentElement,
        noHydration: false
      })

      assert.ok(Array.isArray(result))
      const div = result[0]
      assert.strictEqual(div.children[0].data, 'static content')
      assert.strictEqual(div.children[0].type, 'text')
    })
  })
})
