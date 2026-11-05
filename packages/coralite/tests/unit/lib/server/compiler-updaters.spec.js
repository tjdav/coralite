
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager, generateCompiledUpdaters } from '../../../../lib/server/script-manager.js'

describe('Compiler - Per-Token Updaters', () => {
  it('emits _updaters on component definition when compilerOptimizations is "all"', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-updater-comp',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'Count: {{ count }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const code = sm.virtualModules.get('test-updater-comp') || ''
      assert.strictEqual(code.includes('_updaters: {'), true)
      assert.strictEqual(code.includes('"count": function ()'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('compiled updater reads dynamic getters via _state when raw state value is a function', () => {
    const hydrationMap = {
      tokenBindings: { disableSubmit: [0] },
      texts: [{
        type: 'text',
        isSingleToken: true
      }]
    }
    const code = generateCompiledUpdaters(hydrationMap, new Set())
    assert.strictEqual(code.includes('typeof _rawValue === \'function\' ? this._state["disableSubmit"] : _rawValue'), true)
  })

  it('compiled getter updater reads the derived value from _stateRaw', () => {
    const hydrationMap = {
      tokenBindings: { showChrome: [0] },
      attributes: [{
        type: 'attribute',
        path: [0],
        name: 'hidden',
        template: '{{ showChrome }}',
        tokens: ['showChrome'],
        isSingleToken: true,
        singleTokenKey: 'showChrome',
        attrKind: 1
      }]
    }
    const code = generateCompiledUpdaters(hydrationMap, new Set(['showChrome']))
    assert.strictEqual(code.includes('const value = this._stateRaw["showChrome"]'), true)
    assert.strictEqual(code.includes('const value = this._state["showChrome"]'), false)
  })

  it('generates updaters for both text and attribute tokens in co-existing components', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-banner-comp',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'div',
        attribs: {
          hidden: '{{ isHidden }}'
        },
        children: [{
          type: 'text',
          data: '{{ message }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const code = sm.virtualModules.get('test-banner-comp') || ''
      assert.strictEqual(code.includes('_updaters: {'), true)
      assert.strictEqual(code.includes('"message": function ()'), true)
      assert.strictEqual(code.includes('"isHidden": function ()'), true)
      assert.strictEqual(code.includes('element.removeAttribute(binding.name)'), true)
      assert.strictEqual(code.includes('element.setAttribute(binding.name, \'\')'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('emits _updaters: null when compilerOptimizations is "none"', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'none' })
    sm.registerComponent({
      id: 'test-updater-comp',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'Count: {{ count }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const code = sm.virtualModules.get('test-updater-comp') || ''
      assert.strictEqual(code.includes('_updaters: null'), true)
    } finally {
      await sm.disposeContext()
    }
  })
})
