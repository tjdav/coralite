import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { createTestProject } from '../utils/project.js'

describe('Slotted Refs Resolution', () => {
  it('resolves refs for elements authored in parent template when slotted into a child custom element', (t, done) => {
    const childTagName = 'child-modal-' + Math.random().toString(36).substring(2, 9)
    const parentTagName = 'parent-view-' + Math.random().toString(36).substring(2, 9)

    let childRefResult = undefined
    let parentRefResult = undefined
    let buttonClicked = false

    const ChildModal = createCoraliteClass({
      componentId: 'child-modal',
      templateHTML: '<div class="modal-wrapper"><slot name="actions"></slot></div>',
      client ({ refs }) {
        childRefResult = refs('confirmBtn')
      }
    })

    const ParentView = createCoraliteClass({
      componentId: 'parent-view',
      templateHTML: `<div class="parent-root"><${childTagName} ref="modal"><div slot="actions"><button ref="confirmBtn" type="button">Confirm</button></div></${childTagName}></div>`,
      hydrationMap: {
        refs: [
          { name: 'modal', path: [0, 0] },
          { name: 'confirmBtn', path: [0, 0, 0, 0] }
        ]
      },
      client ({ refs }) {
        parentRefResult = refs('confirmBtn')
        if (parentRefResult) {
          parentRefResult.addEventListener('click', () => {
            buttonClicked = true
          })
        }
      }
    })

    customElements.define(childTagName, ChildModal)
    customElements.define(parentTagName, ParentView)

    const el = document.createElement(parentTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Parent should resolve its own slotted ref
      assert.ok(parentRefResult, 'Parent refs("confirmBtn") should return HTMLElement, got null')
      assert.strictEqual(parentRefResult.tagName, 'BUTTON')
      assert.strictEqual(parentRefResult.textContent, 'Confirm')

      // Child should NOT resolve parent's slotted ref (strict encapsulation)
      assert.strictEqual(childRefResult, null, 'Child refs("confirmBtn") should evaluate to null')

      // Event listener attached via refs('confirmBtn') should work
      parentRefResult.click()
      assert.strictEqual(buttonClicked, true, 'Click event listener should be triggered')

      // Attribute post-setup verification (prefixing and ownership tagging)
      assert.strictEqual(parentRefResult.getAttribute('ref'), `${el._instanceId}__confirmBtn`)
      assert.strictEqual(parentRefResult.getAttribute('data-coralite-owner'), el._instanceId)

      // Testing proxy check
      const testingRefs = el[Symbol.for('coralite.testing')]?.refs
      assert.ok(testingRefs, 'Testing refs proxy should exist')
      assert.strictEqual(testingRefs.confirmBtn, parentRefResult)

      document.body.removeChild(el)
      done()
    })
  })

  it('preserves strict isolation when parent and child share the same ref name', (t, done) => {
    const childTagName = 'child-comp-' + Math.random().toString(36).substring(2, 9)
    const parentTagName = 'parent-comp-' + Math.random().toString(36).substring(2, 9)

    let childRef = null
    let parentRef = null

    const ChildComp = createCoraliteClass({
      componentId: 'child-comp',
      templateHTML: '<div class="child-root"><button ref="actionBtn">Child Action</button><slot></slot></div>',
      hydrationMap: {
        refs: [{ name: 'actionBtn', path: [0, 0] }]
      },
      client ({ refs }) {
        childRef = refs('actionBtn')
      }
    })

    const ParentComp = createCoraliteClass({
      componentId: 'parent-comp',
      templateHTML: `<div class="parent-root"><${childTagName}><button ref="actionBtn">Parent Action</button></${childTagName}></div>`,
      hydrationMap: {
        refs: [{ name: 'actionBtn', path: [0, 0, 0] }]
      },
      client ({ refs }) {
        parentRef = refs('actionBtn')
      }
    })

    customElements.define(childTagName, ChildComp)
    customElements.define(parentTagName, ParentComp)

    const el = document.createElement(parentTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      assert.ok(parentRef, 'Parent ref should exist')
      assert.strictEqual(parentRef.textContent, 'Parent Action')

      assert.ok(childRef, 'Child ref should exist')
      assert.strictEqual(childRef.textContent, 'Child Action')

      assert.notStrictEqual(parentRef, childRef, 'Parent and child refs must be distinct elements')

      document.body.removeChild(el)
      done()
    })
  })

  it('resolves slotted refs in SSR pre-rendered hydration scenario', (t, done) => {
    const childTagName = 'ssr-child-' + Math.random().toString(36).substring(2, 9)
    const parentTagName = 'ssr-parent-' + Math.random().toString(36).substring(2, 9)

    let parentRef = null

    const ChildComp = createCoraliteClass({
      componentId: 'ssr-child',
      templateHTML: '<div><slot name="custom"></slot></div>'
    })

    const ParentComp = createCoraliteClass({
      componentId: 'ssr-parent',
      templateHTML: `<div><${childTagName}><button ref="saveBtn" slot="custom">Save</button></${childTagName}></div>`,
      hydrationMap: {
        refs: [{ name: 'saveBtn', path: [0, 0, 0] }]
      },
      client ({ refs }) {
        parentRef = refs('saveBtn')
      }
    }, null, {}, {
      'ssr-parent-0': { ref_saveBtn: 'ssr-parent-0__saveBtn' }
    })

    // Pre-rendered SSR HTML
    document.body.innerHTML = `<${parentTagName} data-cid="ssr-parent-0" data-coralite-initial><div><${childTagName} data-cid="ssr-child-0" data-coralite-initial><div><slot name="custom" data-coralite-owner="ssr-child-0"><button ref="ssr-parent-0__saveBtn" data-coralite-owner="ssr-parent-0" data-coralite-slot-index="0" slot="custom">Save</button></slot></div></${childTagName}></div></${parentTagName}>`

    customElements.define(childTagName, ChildComp)
    customElements.define(parentTagName, ParentComp)

    const el = document.body.firstElementChild

    queueMicrotask(() => {
      assert.ok(parentRef, 'SSR hydrated parent ref should be resolved')
      assert.strictEqual(parentRef.textContent, 'Save')
      assert.strictEqual(parentRef.getAttribute('ref'), 'ssr-parent-0__saveBtn')
      assert.strictEqual(parentRef.getAttribute('data-coralite-owner'), 'ssr-parent-0')

      document.body.removeChild(el)
      done()
    })
  })

  it('resolves slotted refs across multi-level nested components (grandparent -> parent -> child)', (t, done) => {
    const childTagName = 'deep-child-' + Math.random().toString(36).substring(2, 9)
    const midTagName = 'deep-mid-' + Math.random().toString(36).substring(2, 9)
    const grandTagName = 'deep-grand-' + Math.random().toString(36).substring(2, 9)

    let grandRef = null
    let midRef = null
    let childRef = null

    const ChildComp = createCoraliteClass({
      componentId: 'deep-child',
      templateHTML: '<div><slot></slot></div>',
      client ({ refs }) {
        childRef = refs('deepBtn')
      }
    })

    const MidComp = createCoraliteClass({
      componentId: 'deep-mid',
      templateHTML: `<div><${childTagName}><slot></slot></${childTagName}></div>`,
      client ({ refs }) {
        midRef = refs('deepBtn')
      }
    })

    const GrandComp = createCoraliteClass({
      componentId: 'deep-grand',
      templateHTML: `<div><${midTagName}><button ref="deepBtn">Deep Button</button></${midTagName}></div>`,
      hydrationMap: {
        refs: [{ name: 'deepBtn', path: [0, 0, 0] }]
      },
      client ({ refs }) {
        grandRef = refs('deepBtn')
      }
    })

    customElements.define(childTagName, ChildComp)
    customElements.define(midTagName, MidComp)
    customElements.define(grandTagName, GrandComp)

    const el = document.createElement(grandTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      assert.ok(grandRef, 'Grandparent should resolve deepBtn')
      assert.strictEqual(grandRef.textContent, 'Deep Button')

      assert.strictEqual(midRef, null, 'Mid component should not resolve deepBtn')
      assert.strictEqual(childRef, null, 'Child component should not resolve deepBtn')

      document.body.removeChild(el)
      done()
    })
  })

  it('SSR renderer attaches data-coralite-owner and prefixes ref attributes on component elements', async () => {
    const project = await createTestProject()

    try {
      await project.writeComponent(
        'child-box.html',
        `<template id="child-box">
          <div class="box"><slot name="content"></slot></div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'
          export default defineComponent({})
        </script>`
      )

      await project.writeComponent(
        'parent-box.html',
        `<template id="parent-box">
          <div class="parent">
            <child-box>
              <button ref="slottedAction" slot="content">Slotted Click</button>
            </child-box>
          </div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'
          export default defineComponent({
            client ({ refs }) {
              const btn = refs('slottedAction')
            }
          })
        </script>`
      )

      await project.writePage(
        'index.html',
        `<parent-box></parent-box>`
      )

      const coralite = await project.createCoralite()
      const results = await coralite.build('index.html')

      assert.ok(results && results.length > 0, 'Build should produce page output')
      const outputHtml = results[0].content

      // Verify the rendered HTML contains the prefixed ref and explicit data-coralite-owner
      assert.ok(
        outputHtml.includes('ref="parent-box-0__slottedAction"'),
        `Rendered HTML should contain prefixed ref="parent-box-0__slottedAction". Output:\n${outputHtml}`
      )
      assert.ok(
        outputHtml.includes('data-coralite-owner="parent-box-0"'),
        `Rendered HTML should contain data-coralite-owner="parent-box-0". Output:\n${outputHtml}`
      )
    } finally {
      await project.cleanup()
    }
  })
})
