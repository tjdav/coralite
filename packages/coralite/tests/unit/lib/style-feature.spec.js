import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

// Set up DOM globals before importing element / component modules
const window = new Window()
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.CustomEvent = window.CustomEvent
globalThis.MutationObserver = window.MutationObserver
globalThis.Node = window.Node
globalThis.customElements = window.customElements

const { createTestProject } = await import('../utils/project.js')
const { createCoraliteClass } = await import('../../../lib/coralite-element.js')
const { validateComponentSource } = await import('../../../lib/component-validator.js')
const { createComponentDefinition } = await import('../../../lib/component-setup.js')
const { CoraliteError } = await import('../../../lib/utils/errors.js')

describe('Component Reactive style Feature', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  describe('SSR Rendering', () => {
    test('renders host custom element with computed CSS custom properties and normalized standard properties', async () => {
      const project = await createTestProject({ mode: 'testing' })

      await project.writeComponent('styled-btn.html', `
        <template id="styled-btn">
          <button><slot></slot></button>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'

          export default defineComponent({
            attributes: {
              variant: { type: String, default: 'primary' },
              size: { type: Number, default: 16 }
            },
            style: {
              '--btn-bg': (state) => state.variant === 'primary' ? 'blue' : 'gray',
              fontSize: (state) => state.size,
              lineHeight: 1.5,
              color: 'white'
            }
          })
        </script>
      `)

      await project.writePage('index.html', `
        <styled-btn size="20">Click me</styled-btn>
      `)

      const app = await project.createCoralite()
      const results = await app.build()
      const pageResult = results.find(r => r.path?.pathname === 'index.html' || r.path?.filename?.endsWith('index.html'))
      assert.ok(pageResult)
      assert.ok(pageResult.content.includes('--btn-bg: blue;'))
      assert.ok(pageResult.content.includes('font-size: 20;'))
      assert.ok(pageResult.content.includes('line-height: 1.5;'))
      assert.ok(pageResult.content.includes('color: white;'))

      await project.cleanup()
    })

    test('merges computed styles with pre-existing inline style attribute on tag', async () => {
      const project = await createTestProject({ mode: 'testing' })

      await project.writeComponent('card-box.html', `
        <template id="card-box">
          <div><slot></slot></div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'

          export default defineComponent({
            style: {
              color: 'red',
              '--card-padding': '20px'
            }
          })
        </script>
      `)

      await project.writePage('index.html', `
        <card-box style="margin: 10px; color: blue;">Card Content</card-box>
      `)

      const app = await project.createCoralite()
      const results = await app.build()
      const pageResult = results.find(r => r.path?.pathname === 'index.html' || r.path?.filename?.endsWith('index.html'))
      assert.ok(pageResult)
      assert.ok(pageResult.content.includes('margin: 10px;'))
      // Component computed style 'color: red' overrides static inline tag 'color: blue'
      assert.ok(pageResult.content.includes('color: red;'))
      assert.ok(pageResult.content.includes('--card-padding: 20px;'))

      await project.cleanup()
    })
  })

  describe('Client Reactivity', () => {
    test('updates element inline styles dynamically when reactive state mutates', async () => {
      const componentOptions = {
        componentId: 'my-badge',
        defaultValues: {
          active: true,
          count: 5
        },
        style: {
          '--badge-bg': (state) => state.active ? 'green' : 'gray',
          opacity: (state) => state.active ? 1 : 0,
          zIndex: (state) => state.count
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('my-badge', CustomClass)

      const element = document.createElement('my-badge')
      document.body.appendChild(element)

      assert.equal(element.style.getPropertyValue('--badge-bg'), 'green')
      assert.equal(element.style.getPropertyValue('opacity'), '1')
      assert.equal(element.style.getPropertyValue('z-index'), '5')

      // Mutate state
      // @ts-ignore
      element._state.active = false
      // @ts-ignore
      element._state.count = 0

      // Trigger DOM update
      // @ts-ignore
      element._updateDOM()

      assert.equal(element.style.getPropertyValue('--badge-bg'), 'gray')
      assert.equal(element.style.getPropertyValue('opacity'), '0')
      assert.equal(element.style.getPropertyValue('z-index'), '0')
    })

    test('removes properties when getter returns null, undefined, false, or empty string', () => {
      const componentOptions = {
        componentId: 'toggle-box',
        defaultValues: {
          val: 'initial'
        },
        style: {
          display: (state) => state.val === 'none' ? false : 'block',
          color: (state) => state.val === 'clear' ? null : 'black',
          borderColor: (state) => state.val === 'clear' ? undefined : 'red',
          borderWidth: (state) => state.val === 'clear' ? '' : '1px'
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('toggle-box', CustomClass)

      const element = document.createElement('toggle-box')
      document.body.appendChild(element)

      assert.equal(element.style.getPropertyValue('display'), 'block')
      assert.equal(element.style.getPropertyValue('color'), 'black')
      assert.equal(element.style.getPropertyValue('border-color'), 'red')
      assert.equal(element.style.getPropertyValue('border-width'), '1px')

      // Set to removal triggers
      // @ts-ignore
      element._state.val = 'clear'
      // @ts-ignore
      element._updateDOM()

      assert.equal(element.style.getPropertyValue('color'), '')
      assert.equal(element.style.getPropertyValue('border-color'), '')
      assert.equal(element.style.getPropertyValue('border-width'), '')

      // @ts-ignore
      element._state.val = 'none'
      // @ts-ignore
      element._updateDOM()

      assert.equal(element.style.getPropertyValue('display'), '')
    })

    test('strictly preserves 0 (number zero) as a valid CSS value', () => {
      const componentOptions = {
        componentId: 'zero-comp',
        defaultValues: {
          opacityVal: 0,
          orderVal: 0
        },
        style: {
          opacity: (state) => state.opacityVal,
          order: (state) => state.orderVal
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('zero-comp', CustomClass)

      const element = document.createElement('zero-comp')
      document.body.appendChild(element)

      assert.equal(element.style.getPropertyValue('opacity'), '0')
      assert.equal(element.style.getPropertyValue('order'), '0')
    })
  })

  describe('Key Normalization', () => {
    test('preserves --var custom properties and converts camelCase standard properties to kebab-case', () => {
      const componentOptions = {
        componentId: 'norm-comp',
        defaultValues: {},
        style: {
          '--my-custom-var': '12px',
          fontSize: '14px',
          backgroundColor: 'blue',
          'border-radius': '4px'
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('norm-comp', CustomClass)

      const element = document.createElement('norm-comp')
      document.body.appendChild(element)

      assert.equal(element.style.getPropertyValue('--my-custom-var'), '12px')
      assert.equal(element.style.getPropertyValue('font-size'), '14px')
      assert.equal(element.style.getPropertyValue('background-color'), 'blue')
      assert.equal(element.style.getPropertyValue('border-radius'), '4px')
    })
  })

  describe('Synchronous Enforcement & Exception Handling', () => {
    test('throws CoraliteError if a style property getter returns a Promise', () => {
      const componentOptions = {
        componentId: 'async-style-comp',
        defaultValues: {},
        style: {
          color: () => Promise.resolve('red')
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('async-style-comp', CustomClass)

      const element = document.createElement('async-style-comp')
      element.componentOptions = componentOptions
      // @ts-ignore
      element._setupState()

      assert.throws(() => {
        // @ts-ignore
        element._applyStyles()
      }, (err) => {
        return err instanceof CoraliteError && err.message.includes('must be synchronous')
      })
    })

    test('wraps runtime exception thrown inside style function in CoraliteError', () => {
      const componentOptions = {
        componentId: 'error-style-comp',
        defaultValues: {},
        style: {
          color: () => {
            throw new Error('Custom style calculation error')
          }
        }
      }

      const CustomClass = createCoraliteClass(componentOptions)
      window.customElements.define('error-style-comp', CustomClass)

      const element = document.createElement('error-style-comp')
      element.componentOptions = componentOptions
      // @ts-ignore
      element._setupState()

      assert.throws(() => {
        // @ts-ignore
        element._applyStyles()
      }, (err) => {
        return err instanceof CoraliteError && err.message.includes('failed: Custom style calculation error')
      })
    })
  })

  describe('Definition Time Validation', () => {
    test('throws CoraliteError during component definition if style property is invalid type', async () => {
      // @ts-ignore
      const defFn = createComponentDefinition({ app: { options: {} } })

      await assert.rejects(async () => {
        await defFn({
          style: {
            // @ts-ignore
            color: ['red', 'blue']
          }
        }, {
          state: {},
          module: { id: 'invalid-style' }
        })
      }, (err) => {
        return err instanceof CoraliteError && err.message.includes('must be a function, string, or number')
      })
    })
  })

  describe('Component Validator Unused State Checking', () => {
    test('recognizes state properties read in style getters as used state', () => {
      const source = `
        <template id="test-comp">
          <div>Hello</div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'

          export default defineComponent({
            attributes: {
              variant: { type: String, default: 'primary' },
              themeColor: { type: String, default: 'blue' }
            },
            style: {
              '--bg': (state) => state.variant === 'primary' ? 'black' : 'white',
              color: (state) => state.themeColor
            }
          })
        </script>
      `

      const result = validateComponentSource(source, 'components/test-comp.html')
      assert.equal(result.unused.attributes.length, 0)
    })
  })

  describe('Imperative Boundary Stamping', () => {
    test('Imperative CoraliteElement stamps data-cid during mount to enforce @scope boundary', () => {
      const tagName = 'style-imperative-test'
      if (!window.customElements.get(tagName)) {
        const ElementClass = createCoraliteClass({
          componentId: 'style-imperative-comp',
          defaultValues: {}
        })
        window.customElements.define(tagName, ElementClass)
      }

      const el = document.createElement(tagName)
      document.body.appendChild(el)

      assert.strictEqual(el.getAttribute('data-cid'), el._instanceId)

      document.body.removeChild(el)
    })
  })
})
