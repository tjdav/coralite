import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager } from '../../../../lib/server/script-manager.js'

describe('Compiler - Raw State Read Options', () => {
  it('passes compilerOptimizations option through ScriptManager to component options', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-card',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'hello {{ name }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const virtCode = sm.virtualModules.get('test-card') || ''

      assert.strictEqual(virtCode.includes('compilerOptimizations: "all"'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('passes compilerOptimizations "none" option through ScriptManager when specified', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'none' })
    sm.registerComponent({
      id: 'test-card',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'hello {{ name }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const virtCode = sm.virtualModules.get('test-card') || ''

      assert.strictEqual(virtCode.includes('compilerOptimizations: "none"'), true)
    } finally {
      await sm.disposeContext()
    }
  })
})
