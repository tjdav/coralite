/* eslint-disable no-restricted-globals -- Test fixture builds DOM in virtual window context */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptManager } from '../../../../lib/server/script-manager.js'
import { defineConfig } from '../../../../lib/server/config.js'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('compilerOptimizations and reconcile Flag Combination Audit Matrix', () => {
  it('default config (no flags set) defaults to compilerOptimizations: "all" and reconcile: "full"', () => {
    const config = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages'
    })

    assert.strictEqual(config.compilerOptimizations, 'all')
    assert.strictEqual(config.reconcile, 'full')
  })

  it('compilerOptimizations: "all" enables template cloning, updaters, raw state reads, binding tree, and nodeValue', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'all' })
    sm.registerComponent({
      id: 'test-opt-all',
      isRepeated: true,
      templateAST: [
        {
          type: 'tag',
          name: 'div',
          attribs: {},
          children: [
            {
              type: 'text',
              data: 'Count: {{ count }}'
            }
          ]
        }
      ]
    })

    const { outputFiles } = await sm.compileComponents('development')
    await sm.disposeContext()

    const jsFile = Object.values(outputFiles).find(f => f.path.includes('test-opt-all'))
    assert.ok(jsFile, 'Component output JS file should exist')

    const code = jsFile.text

    // 1. Template cloning marker
    assert.strictEqual(code.includes('useTemplateCloning: true'), true, 'Template cloning should be enabled')
    assert.strictEqual(code.includes('templateElement:'), true, 'templateElement should be emitted')

    // 2. Updaters marker
    assert.strictEqual(code.includes('_updaters: {'), true, '_updaters object should be emitted')

    // 3. Raw reads marker
    assert.strictEqual(code.includes('this._stateRaw["count"]'), true, 'Raw state read _stateRaw should be present in updaters')

    // 4. Single-pass binding tree marker
    assert.strictEqual(code.includes('_bindingTree: {'), true, '_bindingTree object should be emitted')

    // 5. nodeValue writes marker
    assert.strictEqual(code.includes('node.nodeValue !== next'), true, 'nodeValue check should be in emitted updater')
  })

  it('compilerOptimizations: "none" disables template cloning, updaters, binding tree, and falls back to pre-P3 paths', async () => {
    const sm = new ScriptManager({ compilerOptimizations: 'none' })
    sm.registerComponent({
      id: 'test-opt-none',
      isRepeated: true,
      templateAST: [
        {
          type: 'tag',
          name: 'div',
          attribs: {},
          children: [
            {
              type: 'text',
              data: 'Count: {{ count }}'
            }
          ]
        }
      ]
    })

    const { outputFiles } = await sm.compileComponents('development')
    await sm.disposeContext()

    const jsFile = Object.values(outputFiles).find(f => f.path.includes('test-opt-none'))
    assert.ok(jsFile, 'Component output JS file should exist')

    const code = jsFile.text

    // 1. Template cloning disabled
    assert.strictEqual(code.includes('useTemplateCloning: false'), true, 'Template cloning should be disabled')
    assert.strictEqual(code.includes('templateElement: null'), true, 'templateElement should be null')

    // 2. Updaters disabled
    assert.strictEqual(code.includes('_updaters: null'), true, '_updaters should be null')

    // 3. Binding tree disabled
    assert.strictEqual(code.includes('_bindingTree: null'), true, '_bindingTree should be null')

    // 4. Option stored as "none"
    assert.strictEqual(code.includes('compilerOptimizations: "none"'), true, 'compilerOptimizations: "none" stored on definition')
  })

  it('compilerOptimizations accepts string array in config validation', () => {
    const config = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      compilerOptimizations: ['template-cloning']
    })

    assert.deepStrictEqual(config.compilerOptimizations, ['template-cloning'])
  })

  it('reconcile: "minimal" vs reconcile: "full" behavior in component runtime', async () => {
    function createTestComponent (reconcileMode) {
      const tagName = 'test-reconcile-' + Math.random().toString(36).substring(2, 9)

      const ComponentClass = createCoraliteClass({
        componentId: tagName,
        reconcile: reconcileMode,
        defaultValues: {
          items: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }]
        },
        templateHTML: '<div ref="list"><div class="row" data-id="1">A</div><div class="row" data-id="2">B</div></div>',
        hydrationMap: {
          refs: [{ name: 'list' }]
        },
        client ({ state, observe }) {
          state.observerCount = 0
          observe('items', () => {
            state.observerCount++
          })
        }
      })

      customElements.define(tagName, ComponentClass)
      const el = document.createElement(tagName)
      document.body.appendChild(el)
      return el
    }

    // 1. reconcile: "full" fires observer on swap
    const fullEl = createTestComponent('full')
    await fullEl.updateComplete
    const fullItems = fullEl._state.items
    fullEl._state.items = [fullItems[1], fullItems[0]]
    await fullEl.updateComplete
    assert.strictEqual(fullEl._state.observerCount, 1, 'reconcile: "full" fires observer callback on swap')

    // 2. reconcile: "minimal" bypasses observer on swap
    const minimalEl = createTestComponent('minimal')
    await minimalEl.updateComplete
    const minimalItems = minimalEl._state.items
    minimalEl._state.items = [minimalItems[1], minimalItems[0]]
    await minimalEl.updateComplete
    assert.strictEqual(minimalEl._state.observerCount, 0, 'reconcile: "minimal" bypasses observer callback on swap')
  })

  it('compilerOptimizations: "none" + reconcile: "minimal" operate independently without conflict', async () => {
    const config = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      compilerOptimizations: 'none',
      reconcile: 'minimal'
    })

    assert.strictEqual(config.compilerOptimizations, 'none')
    assert.strictEqual(config.reconcile, 'minimal')

    const sm = new ScriptManager({ compilerOptimizations: config.compilerOptimizations })
    sm.registerComponent({
      id: 'test-both-flags',
      templateAST: [{ type: 'tag', name: 'div', attribs: {}, children: [] }]
    })

    const { outputFiles } = await sm.compileComponents('development')
    await sm.disposeContext()

    const jsFile = Object.values(outputFiles).find(f => f.path.includes('test-both-flags'))
    assert.ok(jsFile)
    const code = jsFile.text

    assert.strictEqual(code.includes('compilerOptimizations: "none"'), true)
    assert.strictEqual(code.includes('_updaters: null'), true)
    assert.strictEqual(code.includes('_bindingTree: null'), true)
  })
})
