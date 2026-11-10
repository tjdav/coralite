import { describe, it, beforeEach, before } from 'node:test'
import assert from 'node:assert/strict'
import { initHasher } from '../../../../../lib/server/utils/manifest.js'
import {
  extractScriptStylesheets,
  clearScriptStylesheetCache
} from '../../../../../lib/server/utils/dependency-stylesheets.js'
import {
  extractComponentProperty,
  extractComponentProperties,
  clearASTCache
} from '../../../../../lib/server/utils/server.js'
import { ScriptManager } from '../../../../../lib/server/script-manager.js'

describe('Parsing pipeline reuse', () => {
  before(async () => {
    await initHasher()
  })

  beforeEach(() => {
    clearASTCache()
    clearScriptStylesheetCache()
  })

  describe('extractScriptStylesheets() result cache', () => {
    it('reuses the same result for identical code, file path, and function mode', () => {
      const code = `export async function client () {
        await import('./theme.css')
      }`
      const options = { filePath: '/site/components/card.html' }

      const first = extractScriptStylesheets(code, options)
      const second = extractScriptStylesheets(code, options)

      assert.strictEqual(first, second)
      assert.strictEqual(first.code, second.code)
      assert.strictEqual(first.declarations.length, 1)
    })

    it('keeps file path and allowAllFunctions variants separate', () => {
      const code = `export async function client () {
        await import('./theme.css')
      }`

      const first = extractScriptStylesheets(code, { filePath: '/site/components/a/card.html' })
      const second = extractScriptStylesheets(code, { filePath: '/site/pages/card.html' })
      const isolated = extractScriptStylesheets(code, {
        filePath: '/site/components/a/card.html',
        allowAllFunctions: true
      })

      assert.notStrictEqual(first, second)
      assert.notStrictEqual(first.declarations[0].handle, second.declarations[0].handle)
      assert.notStrictEqual(first, isolated)
      assert.strictEqual(isolated.code, first.code)
    })

    it('re-parses after clearScriptStylesheetCache()', () => {
      const code = `export async function client () {
        await import('./theme.css')
      }`
      const options = { filePath: '/site/components/card.html' }

      const first = extractScriptStylesheets(code, options)
      clearScriptStylesheetCache()
      const second = extractScriptStylesheets(code, options)

      assert.notStrictEqual(first, second)
      assert.deepStrictEqual(first, second)
    })

    it('does not cache scripts without import expressions', () => {
      const first = extractScriptStylesheets('export function client () {}', {
        filePath: '/site/components/card.html'
      })
      const second = extractScriptStylesheets('export function client () {}', {
        filePath: '/site/components/card.html'
      })

      assert.notStrictEqual(first, second)
      assert.deepStrictEqual(first, second)
    })

    it('preserves non-throwing behavior for invalid full scripts', () => {
      const code = `import './theme.css'
        const = ;`

      const result = extractScriptStylesheets(code, {
        filePath: '/site/components/bad.html'
      })

      assert.equal(result.code, code)
      assert.deepStrictEqual(result.declarations, [])
    })
  })

  describe('extractComponentProperties() single walk', () => {
    it('matches extractComponentProperty() for defineComponent exports', () => {
      const code = `import { defineComponent } from 'coralite'
        export default defineComponent({
          state () {
            return { count: 1 }
          },
          async server () {
            return { count: 2 }
          },
          getters: {
            double: ({ state }) => state.count * 2
          },
          client ({ state }) {
            console.log(state.count)
          }
        })
      `
      const names = ['state', 'server', 'getters', 'client', 'attributes', 'slots', 'onError']
      const extracted = extractComponentProperties(code, names)

      for (const name of names) {
        assert.deepStrictEqual(extracted[name], extractComponentProperty(code, name))
      }
      assert.equal(extracted.attributes, null)
      assert.equal(extracted.slots, null)
      assert.equal(extracted.onError, null)
    })

    it('matches extractComponentProperty() for named exports and specifiers', () => {
      const code = `const sharedGetters = {
          double: ({ state }) => state.count * 2
        }
        function server () {
          return { count: 1 }
        }
        export { sharedGetters as getters, server }
        export function client ({ state }) {
          console.log(state.count)
        }
        export const style = {
          ':host': { display: 'block' }
        }
      `
      const names = ['getters', 'server', 'client', 'style', 'attributes']
      const extracted = extractComponentProperties(code, names)

      for (const name of names) {
        assert.deepStrictEqual(extracted[name], extractComponentProperty(code, name))
      }
      assert.equal(extracted.attributes, null)
    })

    it('returns null entries for every missing property', () => {
      const extracted = extractComponentProperties('export const client = () => {}', [
        'client',
        'server',
        'getters'
      ])

      assert.ok(extracted.client)
      assert.equal(extracted.server, null)
      assert.equal(extracted.getters, null)
    })
  })

  describe('hydration map reuse', () => {
    it('stores the precomputed map and preserves it across non-override registrations', () => {
      const sm = new ScriptManager()
      const firstMap = {
        version: 2,
        texts: [],
        attributes: [],
        refs: [],
        slots: [],
        requiredTokens: [],
        tokenBindings: {}
      }
      const secondMap = {
        ...firstMap,
        requiredTokens: ['count']
      }

      sm.registerComponent({
        id: 'card',
        hydrationMap: firstMap
      })
      assert.strictEqual(sm.sharedFunctions.card.hydrationMap, firstMap)

      sm.registerComponent({
        id: 'card',
        hydrationMap: secondMap
      })
      assert.strictEqual(sm.sharedFunctions.card.hydrationMap, firstMap)

      sm.registerComponent({
        id: 'card',
        hydrationMap: secondMap,
        override: true
      })
      assert.strictEqual(sm.sharedFunctions.card.hydrationMap, secondMap)
    })
  })
})
