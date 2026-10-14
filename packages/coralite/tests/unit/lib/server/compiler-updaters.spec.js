
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager } from '../../../../lib/server/script-manager.js'

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
