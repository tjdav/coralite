
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ScriptManager, shouldUseTemplateCloning } from '../../../../lib/server/script-manager.js'

describe('Compiler - Template Cloning Optimization', () => {
  it('should enable template cloning when component is rendered multiple times', () => {
    const repeatedComp = {
      id: 'repeated-card',
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: []
      }]
    }
    const pageComp = {
      id: 'page',
      templateAST: [
        {
          type: 'tag',
          name: 'repeated-card',
          children: []
        },
        {
          type: 'tag',
          name: 'repeated-card',
          children: []
        }
      ]
    }
    const all = {
      'repeated-card': repeatedComp,
      page: pageComp
    }

    assert.strictEqual(shouldUseTemplateCloning(repeatedComp, all, 'all'), true)
  })

  it('should NOT enable template cloning when component is rendered exactly once', () => {
    const singleComp = {
      id: 'single-card',
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: []
      }]
    }
    const pageComp = {
      id: 'page',
      templateAST: [
        {
          type: 'tag',
          name: 'single-card',
          children: []
        }
      ]
    }
    const all = {
      'single-card': singleComp,
      page: pageComp
    }

    assert.strictEqual(shouldUseTemplateCloning(singleComp, all, 'all'), false)
  })

  it('should fall back when template contains executable script tag', () => {
    const scriptComp = {
      id: 'script-card',
      templateAST: [
        {
          type: 'tag',
          name: 'div',
          children: []
        },
        {
          type: 'tag',
          name: 'script',
          children: []
        }
      ]
    }
    const pageComp = {
      id: 'page',
      templateAST: [
        {
          type: 'tag',
          name: 'script-card',
          children: []
        },
        {
          type: 'tag',
          name: 'script-card',
          children: []
        }
      ]
    }
    const all = {
      'script-card': scriptComp,
      page: pageComp
    }

    assert.strictEqual(shouldUseTemplateCloning(scriptComp, all, 'all'), false)
  })

  it('should fall back when template contains slot tag requiring per-instance reconciliation', () => {
    const slotComp = {
      id: 'slot-card',
      templateAST: [
        {
          type: 'tag',
          name: 'div',
          children: [{
            type: 'tag',
            name: 'slot',
            children: []
          }]
        }
      ]
    }
    const pageComp = {
      id: 'page',
      templateAST: [
        {
          type: 'tag',
          name: 'slot-card',
          children: []
        },
        {
          type: 'tag',
          name: 'slot-card',
          children: []
        }
      ]
    }
    const all = {
      'slot-card': slotComp,
      page: pageComp
    }

    assert.strictEqual(shouldUseTemplateCloning(slotComp, all, 'all'), false)
  })

  it('should disable template cloning when compilerOptimizations is set to none', () => {
    const repeatedComp = {
      id: 'repeated-card',
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: []
      }]
    }
    const pageComp = {
      id: 'page',
      templateAST: [
        {
          type: 'tag',
          name: 'repeated-card',
          children: []
        },
        {
          type: 'tag',
          name: 'repeated-card',
          children: []
        }
      ]
    }
    const all = {
      'repeated-card': repeatedComp,
      page: pageComp
    }

    assert.strictEqual(shouldUseTemplateCloning(repeatedComp, all, 'none'), false)
  })

  it('should emit templateElement in compileComponents when cloning is active', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'repeated-card',
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'hello'
        }]
      }],
      isRepeated: true
    })

    try {
      await sm.compileComponents('development')
      const virtCode = sm.virtualModules.get('repeated-card') || ''

      assert.strictEqual(virtCode.includes('useTemplateCloning: true'), true)
      assert.strictEqual(virtCode.includes("document.createElement('template')"), true)
    } finally {
      await sm.disposeContext()
    }
  })

  it('should NOT emit templateElement in compileComponents when compilerOptimizations is none', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'none' })
    sm.registerComponent({
      id: 'repeated-card',
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [{
          type: 'text',
          data: 'hello'
        }]
      }],
      isRepeated: true
    })

    try {
      await sm.compileComponents('development')
      const virtCode = sm.virtualModules.get('repeated-card') || ''

      assert.strictEqual(virtCode.includes('useTemplateCloning: false'), true)
      assert.strictEqual(virtCode.includes("document.createElement('template')"), false)
    } finally {
      await sm.disposeContext()
    }
  })
})
