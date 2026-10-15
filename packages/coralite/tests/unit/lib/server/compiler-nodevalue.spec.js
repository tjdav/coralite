import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager, generateTokenUpdaterCode } from '../../../../lib/server/script-manager.js'
import { generateBindingTree } from '../../../../lib/shared/core.js'

describe('Compiler - Text Bindings nodeValue Emission', () => {
  it('emits node.nodeValue writes for single-token text bindings', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-nodevalue-single',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'p',
        children: [{
          type: 'text',
          data: '{{ name }}'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const code = sm.virtualModules.get('test-nodevalue-single') || ''
      assert.strictEqual(code.includes('node.nodeValue !== next'), true)
      assert.strictEqual(code.includes('node.nodeValue = next'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('emits node.nodeValue writes for multi-segment text bindings', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-nodevalue-multi',
      isRepeated: true,
      templateAST: [{
        type: 'tag',
        name: 'p',
        children: [{
          type: 'text',
          data: 'Hello {{ firstName }} {{ lastName }}!'
        }]
      }]
    })

    try {
      await sm.compileComponents('development')
      const code = sm.virtualModules.get('test-nodevalue-multi') || ''
      assert.strictEqual(code.includes('node.nodeValue !== next'), true)
      assert.strictEqual(code.includes('node.nodeValue = next'), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('generateTokenUpdaterCode outputs nodeValue snippet for text bindings', () => {
    const textBinding = {
      type: 'text',
      isSingleToken: true,
      singleTokenKey: 'title'
    }
    const snippet = generateTokenUpdaterCode(textBinding, 0, 'title', false)
    assert.ok(snippet.includes('node.nodeValue !== next'))
    assert.ok(snippet.includes('node.nodeValue = next'))
  })

  it('binding tree carries type field distinguishing text from attribute', () => {
    const map = {
      texts: [{
        path: [0, 0],
        template: '{{ title }}',
        type: 'text'
      }],
      attributes: [{
        path: [0],
        name: 'class',
        template: '{{ cls }}'
      }]
    }
    const tree = generateBindingTree(map)
    assert.ok(tree)
    assert.strictEqual(tree.children[0].children[0].match[0].type, 'text')
    assert.strictEqual(tree.children[0].match[0].type, 'attribute')
  })
})
