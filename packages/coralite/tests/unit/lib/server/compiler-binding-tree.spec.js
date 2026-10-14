import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager } from '../../../../lib/server/script-manager.js'

describe('Compiler - Binding Tree Emission', () => {
  it('emits _bindingTree on component definition when compilerOptimizations is "all"', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-binding-tree-comp',
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
      const code = sm.virtualModules.get('test-binding-tree-comp') || ''
      assert.strictEqual(code.includes('_bindingTree: {'), true)
      assert.strictEqual(code.includes('"match":'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('emits _bindingTree: null when compilerOptimizations is "none"', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'none' })
    sm.registerComponent({
      id: 'test-binding-tree-comp',
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
      const code = sm.virtualModules.get('test-binding-tree-comp') || ''
      assert.strictEqual(code.includes('_bindingTree: null'), true)
    } finally {
      await sm.disposeContext()
    }
  })
})
