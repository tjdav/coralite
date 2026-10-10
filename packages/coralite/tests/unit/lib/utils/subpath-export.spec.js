import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createContext } from 'node:vm'
import * as utils from '../../../../lib/utils/index.js'
import * as serverUtilsBase from '../../../../lib/utils/server/index.js'
import { isContextMap } from '../../../../lib/utils/core.js'
import { enhanceNode, relinkChildren } from '../../../../lib/utils/server/dom.js'
import { findAndExtractScript } from '../../../../lib/utils/server/server.js'
import { createModuleLinker, evaluateProduction } from '../../../../lib/compiler.js'

describe('Subpath Exports & DOM Prototype Hardening', () => {
  it('coralite/utils entrypoint does not export parseHTML (isomorphic boundary)', () => {
    // @ts-ignore
    assert.strictEqual(utils.parseHTML, undefined)
  })

  it('coralite/utils/server entrypoint exports full server DOM utilities', () => {
    assert.strictEqual(typeof serverUtilsBase.parseHTML, 'function')
    assert.strictEqual(typeof serverUtilsBase.parseModule, 'function')
    assert.strictEqual(typeof serverUtilsBase.createElement, 'function')
    assert.strictEqual(typeof serverUtilsBase.createTextNode, 'function')
    assert.strictEqual(typeof serverUtilsBase.enhanceNode, 'function')
  })

  it('enhanceNode and relinkChildren safely reject non-objects and function nodes', () => {
    const fnNode = function () {}
    const nullNode = null
    const strNode = 'string'
    const numNode = 42

    assert.strictEqual(enhanceNode(fnNode), fnNode)
    assert.strictEqual(enhanceNode(nullNode), nullNode)
    assert.strictEqual(enhanceNode(strNode), strNode)
    assert.strictEqual(enhanceNode(numNode), numNode)

    const parent = {
      type: 'tag',
      name: 'div',
      children: [null, fnNode, 'text', 123]
    }

    assert.doesNotThrow(() => {
      relinkChildren(parent)
    })
  })

  it('findAndExtractScript filters coralite/utils/server imports from client virtual scripts', () => {
    const code = `
      import { defineComponent } from 'coralite'
      import { parseHTML } from 'coralite/utils/server'
      import { createElement } from 'coralite/utils/server/dom'
      import { helper } from './local-helper.js'

      export default defineComponent({
        client ({ refs }) {
          console.log('client code')
        }
      })
    `

    const extracted = findAndExtractScript(code)
    assert.ok(extracted)
    assert.ok(Array.isArray(extracted.importStatements))
    assert.strictEqual(extracted.importStatements.length, 2)
    assert.ok(extracted.importStatements.some(stmt => stmt.includes('coralite')))
    assert.ok(extracted.importStatements.some(stmt => stmt.includes('./local-helper.js')))
    assert.ok(!extracted.importStatements.some(stmt => stmt.includes('coralite/utils/server')))
  })

  it('createModuleLinker creates VM module with named exports for coralite/utils/server', async () => {
    const mergedServerUtils = {
      ...serverUtilsBase,
      customAppWrapper: () => {}
    }

    const linker = createModuleLinker({
      path: { pathname: '/tmp/test.js', dirname: '/tmp' },
      context: {},
      source: {
        utils: {
          customAppWrapper: mergedServerUtils.customAppWrapper
        }
      },
      importModuleDynamically: async () => {}
    })

    const mockReferencingModule = {
      context: createContext({
        __coralite_server_utils__: mergedServerUtils
      })
    }

    // @ts-ignore
    const mod = await linker('coralite/utils/server', mockReferencingModule, { attributes: {} })
    assert.ok(mod)
    await mod.link(linker)
    await mod.evaluate()

    assert.strictEqual(typeof mod.namespace.parseHTML, 'function')
    assert.strictEqual(typeof mod.namespace.createElement, 'function')
    assert.strictEqual(typeof mod.namespace.createTextNode, 'function')
    assert.strictEqual(typeof mod.namespace.customAppWrapper, 'function')
    assert.ok(mod.namespace.default)
    assert.strictEqual(typeof mod.namespace.default.parseHTML, 'function')
  })

  it('isContextMap correctly identifies Map instances and resists prototype pollution', () => {
    assert.strictEqual(isContextMap(new Map()), true)
    assert.strictEqual(isContextMap({ get: () => {}, has: () => {} }), true)
    assert.strictEqual(isContextMap({}), false)
    assert.strictEqual(isContextMap(null), false)
    assert.strictEqual(isContextMap(undefined), false)
    assert.strictEqual(isContextMap('string'), false)

    const originalToString = Object.prototype.toString
    try {
      // @ts-ignore
      Object.prototype.toString = function () {
        return '[object Map]'
      }

      // Plain object without get and has should still return false because isContextMap uses cached objectToString
      assert.strictEqual(isContextMap({}), false)
      assert.strictEqual(isContextMap({ foo: 'bar' }), false)
    } finally {
      Object.prototype.toString = originalToString
    }
  })

  it('evaluateProduction exposes merged serverUtils via customRequire', async () => {
    const customAppWrapper = () => {}
    const moduleComponent = {
      path: { pathname: '/tmp/test-comp.js', dirname: '/tmp' },
      result: {}
    }

    const result = await evaluateProduction({
      module: {
        id: 'test-production-module',
        script: `
          const serverUtils = require('coralite/utils/server');
          module.exports.default = {
            parseHTML: serverUtils.parseHTML,
            customAppWrapper: serverUtils.customAppWrapper,
            defaultExport: serverUtils.default
          };
        `
      },
      state: {},
      page: {},
      root: {},
      contextId: 'test-context',
      session: { source: { contextInstances: {} } },
      noHydration: false,
      app: {},
      source: {
        plugins: {},
        utils: {
          customAppWrapper
        }
      },
      bindPlugins: async () => ({}),
      defineComponent: (o) => o,
      createExecutionError: (err) => err,
      getComponent: () => moduleComponent
    })

    assert.ok(result)
    assert.strictEqual(typeof result.parseHTML, 'function')
    assert.strictEqual(typeof result.customAppWrapper, 'function')
    assert.ok(result.defaultExport)
    assert.strictEqual(typeof result.defaultExport.parseHTML, 'function')
    assert.strictEqual(typeof result.defaultExport.customAppWrapper, 'function')
  })
})
