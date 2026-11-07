import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { createTestProject } from '../utils/project.js'
import { setupPageRuntime } from '../../../lib/client/element.js'

describe('Unified Boolean and ARIA Attribute Reflection for Pages', () => {
  let project

  afterEach(async () => {
    if (project?.cleanup) {
      await project.cleanup()
    }
  })

  describe('SSR Page Attribute Reflection', () => {
    it('omits boolean attributes when value is falsy and sets to empty string when truthy', async () => {
      project = await createTestProject({ mode: 'development' })

      await project.writePage('index.html', `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <div data-testid="visible-box" hidden="{{ isHidden }}">Hello Visible</div>
          <div data-testid="hidden-box" hidden="{{ isShown }}">Hello Hidden</div>
          <button data-testid="disabled-btn" disabled="{{ isDisabled }}">Submit</button>
          <button data-testid="enabled-btn" disabled="{{ isEnabled }}">Submit</button>
          <input data-testid="readonly-input" readonly="{{ isReadonly }}" />
          <input data-testid="editable-input" readonly="{{ isEditable }}" />
        </body>
        </html>
        <script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            server: () => ({
              isHidden: false,
              isShown: true,
              isDisabled: true,
              isEnabled: false,
              isReadonly: true,
              isEditable: false
            })
          })
        </script>
      `)

      const coralite = await project.createCoralite()
      const results = await coralite.build()
      const indexResult = results.find(r => r.path.filename === 'index.html')
      assert.ok(indexResult)
      const html = indexResult.content

      // Verify hidden attribute omitted on visible-box and present on hidden-box
      assert.ok(html.includes('data-testid="visible-box"'))
      const visibleBoxMatch = html.match(/<div[^>]*data-testid="visible-box"[^>]*>/)
      assert.ok(visibleBoxMatch)
      assert.ok(!visibleBoxMatch[0].includes('hidden'))

      const hiddenBoxMatch = html.match(/<div[^>]*data-testid="hidden-box"[^>]*>/)
      assert.ok(hiddenBoxMatch)
      assert.ok(hiddenBoxMatch[0].includes('hidden'))
      assert.ok(!hiddenBoxMatch[0].includes('hidden="false"'))

      // Verify disabled attribute
      const disabledBtnMatch = html.match(/<button[^>]*data-testid="disabled-btn"[^>]*>/)
      assert.ok(disabledBtnMatch)
      assert.ok(disabledBtnMatch[0].includes('disabled'))
      assert.ok(!disabledBtnMatch[0].includes('disabled="false"'))

      const enabledBtnMatch = html.match(/<button[^>]*data-testid="enabled-btn"[^>]*>/)
      assert.ok(enabledBtnMatch)
      assert.ok(!enabledBtnMatch[0].includes('disabled'))

      // Verify readonly attribute
      const readonlyInputMatch = html.match(/<input[^>]*data-testid="readonly-input"[^>]*>/)
      assert.ok(readonlyInputMatch)
      assert.ok(readonlyInputMatch[0].includes('readonly'))

      const editableInputMatch = html.match(/<input[^>]*data-testid="editable-input"[^>]*>/)
      assert.ok(editableInputMatch)
      assert.ok(!editableInputMatch[0].includes('readonly'))
    })

    it('handles ARIA boolean state attributes and general ARIA attributes properly', async () => {
      project = await createTestProject({ mode: 'development' })

      await project.writePage('index.html', `
        <!DOCTYPE html>
        <html>
        <head><title>ARIA Test</title></head>
        <body>
          <button data-testid="expanded-btn" aria-expanded="{{ isOpen }}">Menu</button>
          <button data-testid="collapsed-btn" aria-expanded="{{ isClosed }}">Menu</button>
          <button data-testid="null-aria-btn" aria-expanded="{{ isNullState }}">Menu</button>
          <div data-testid="aria-label-box" aria-label="{{ labelText }}">Box</div>
          <div data-testid="empty-aria-box" aria-label="{{ emptyLabel }}">Box</div>
        </body>
        </html>
        <script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            server: () => ({
              isOpen: true,
              isClosed: false,
              isNullState: null,
              labelText: 'Info Dialog',
              emptyLabel: ''
            })
          })
        </script>
      `)

      const coralite = await project.createCoralite()
      const results = await coralite.build()
      const indexResult = results.find(r => r.path.filename === 'index.html')
      assert.ok(indexResult)
      const html = indexResult.content

      // aria-expanded="true" and aria-expanded="false"
      const expandedMatch = html.match(/<button[^>]*data-testid="expanded-btn"[^>]*>/)
      assert.ok(expandedMatch)
      assert.ok(expandedMatch[0].includes('aria-expanded="true"'))

      const collapsedMatch = html.match(/<button[^>]*data-testid="collapsed-btn"[^>]*>/)
      assert.ok(collapsedMatch)
      assert.ok(collapsedMatch[0].includes('aria-expanded="false"'))

      // null aria-expanded should be omitted
      const nullAriaMatch = html.match(/<button[^>]*data-testid="null-aria-btn"[^>]*>/)
      assert.ok(nullAriaMatch)
      assert.ok(!nullAriaMatch[0].includes('aria-expanded'))

      // general aria attribute
      const labelMatch = html.match(/<div[^>]*data-testid="aria-label-box"[^>]*>/)
      assert.ok(labelMatch)
      assert.ok(labelMatch[0].includes('aria-label="Info Dialog"'))

      const emptyLabelMatch = html.match(/<div[^>]*data-testid="empty-aria-box"[^>]*>/)
      assert.ok(emptyLabelMatch)
      assert.ok(!emptyLabelMatch[0].includes('aria-label'))
    })

    it('handles custom element declared boolean attributes in SSR', async () => {
      project = await createTestProject({ mode: 'development' })

      await project.writeComponent('ui-toggle.html', `
        <template id="ui-toggle">
          <slot></slot>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'
          export default defineComponent({
            attributes: {
              active: Boolean,
              loading: { type: Boolean }
            }
          })
        </script>
      `)

      await project.writePage('index.html', `
        <!DOCTYPE html>
        <html>
        <head><title>Custom Elements Test</title></head>
        <body>
          <ui-toggle data-testid="toggle-on" active="{{ isActive }}" loading="{{ isLoading }}">Active</ui-toggle>
          <ui-toggle data-testid="toggle-off" active="{{ isInactive }}" loading="{{ notLoading }}">Inactive</ui-toggle>
        </body>
        </html>
        <script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            server: () => ({
              isActive: true,
              isLoading: true,
              isInactive: false,
              notLoading: 'false'
            })
          })
        </script>
      `)

      const coralite = await project.createCoralite()
      const results = await coralite.build()
      const indexResult = results.find(r => r.path.filename === 'index.html')
      assert.ok(indexResult)
      const html = indexResult.content

      const toggleOnMatch = html.match(/<ui-toggle[^>]*data-testid="toggle-on"[^>]*>/)
      assert.ok(toggleOnMatch)
      assert.ok(toggleOnMatch[0].includes('active'))
      assert.ok(toggleOnMatch[0].includes('loading'))

      const toggleOffMatch = html.match(/<ui-toggle[^>]*data-testid="toggle-off"[^>]*>/)
      assert.ok(toggleOffMatch)
      assert.ok(!toggleOffMatch[0].includes('active'))
      assert.ok(!toggleOffMatch[0].includes('loading'))
    })
  })

  describe('Client Runtime Page Attribute Reactivity', () => {
    let window
    let document

    beforeEach(() => {
      window = new Window({ url: 'http://localhost' })
      document = window.document
      global.window = window
      global.document = document
      global.Event = window.Event
      global.HTMLElement = window.HTMLElement
      global.CustomEvent = window.CustomEvent
      global.MutationObserver = window.MutationObserver
      global.Node = window.Node
      global.customElements = window.customElements
    })

    afterEach(() => {
      delete global.window
      delete global.document
      delete global.Event
      delete global.HTMLElement
      delete global.CustomEvent
      delete global.MutationObserver
      delete global.Node
      delete global.customElements
    })

    it('dynamically reflects and removes boolean attributes and ARIA attributes on state mutations', async () => {
      document.documentElement.innerHTML = `
        <head></head>
        <body>
          <div id="target" data-coralite-page-token="tok-1" data-testid="target">Box</div>
          <button id="btn" data-coralite-page-token="tok-2">Toggle</button>
        </body>
      `

      let receivedState = null

      const pageConfig = {
        state: {
          isHidden: false,
          isExpanded: false
        },
        route: { path: '/' },
        tokens: {
          'tok-1': {
            attrs: {
              hidden: '{{ isHidden }}'
            },
            texts: []
          },
          'tok-2': {
            attrs: {
              'aria-expanded': '{{ isExpanded }}'
            },
            texts: []
          }
        },
        client: async ({ state }) => {
          receivedState = state
        }
      }

      await setupPageRuntime(pageConfig)

      const targetEl = document.getElementById('target')
      const btnEl = document.getElementById('btn')

      // Initial state: hidden is falsy, should be omitted; aria-expanded is false, should be "false"
      assert.strictEqual(targetEl.hasAttribute('hidden'), false)
      assert.strictEqual(btnEl.getAttribute('aria-expanded'), 'false')

      // Mutate isHidden to true
      receivedState.isHidden = true
      receivedState.isExpanded = true
      await new Promise(resolve => setTimeout(resolve, 20))

      assert.strictEqual(targetEl.hasAttribute('hidden'), true)
      assert.strictEqual(targetEl.getAttribute('hidden'), '')
      assert.strictEqual(btnEl.getAttribute('aria-expanded'), 'true')

      // Mutate back to falsy
      receivedState.isHidden = false
      receivedState.isExpanded = null
      await new Promise(resolve => setTimeout(resolve, 20))

      assert.strictEqual(targetEl.hasAttribute('hidden'), false)
      assert.strictEqual(btnEl.hasAttribute('aria-expanded'), false)
    })
  })
})
