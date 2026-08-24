import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { normalizeAndValidateAttributes, createComponentDefinition } from '../../../lib/component-setup.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('Component Attribute transform Pipeline', () => {
  describe('Definition-Time Validation', () => {
    it('throws CoraliteError if transform is provided and is not a function', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          title: { transform: 'not-a-function' }
        }, 'test-comp')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "test-comp" attribute "title" transform property must be a function.')
        return true
      })
    })

    it('accepts valid transform function in attribute schema', () => {
      const normalized = normalizeAndValidateAttributes({
        title: {
          type: String,
          transform: (val) => String(val).trim().toLowerCase()
        }
      }, 'test-comp')

      assert.strictEqual(typeof normalized.title.transform, 'function')
    })
  })

  describe('SSR & Initial Attributes Pipeline', () => {
    it('applies transform on incoming attribute state during SSR', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const context = {
        state: { tag: '  Frontend Framework  ' },
        module: { id: 'tag-comp', path: { pathname: '/tag.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          tag: {
            type: String,
            transform: (val) => val.trim().toLowerCase()
          }
        }
      }, context)

      assert.strictEqual(result.tag, 'frontend framework')
    })

    it('applies transform to default values when attribute is omitted', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const context = {
        state: {},
        module: { id: 'tag-comp', path: { pathname: '/tag.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          slug: {
            type: String,
            default: '  HELLO World  ',
            transform: (val) => val.trim().toLowerCase().replace(/\s+/g, '-')
          }
        }
      }, context)

      assert.strictEqual(result.slug, 'hello-world')
    })

    it('records state.errors and error_* tokens in Step 1 if required attribute is omitted', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const context = {
        state: {},
        module: { id: 'req-comp', path: { pathname: '/req.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          apiKey: {
            type: String,
            required: true,
            transform: (val) => val.trim()
          }
        }
      }, context)

      assert.strictEqual(result.errors.apiKey, 'Attribute "apiKey" is required.')
      assert.strictEqual(result.error_apiKey, 'Attribute "apiKey" is required.')
    })

    it('executes pipeline in order: required -> coerce -> transform -> values check', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const context = {
        state: { mode: '  DEV  ' },
        module: { id: 'env-comp', path: { pathname: '/env.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          mode: {
            values: ['dev', 'prod'],
            transform: (val) => String(val).trim().toLowerCase()
          }
        }
      }, context)

      assert.strictEqual(result.mode, 'dev')
    })
  })

  describe('Synchronous Enforcement & Exception Wrapping', () => {
    it('throws CoraliteError if transform returns a Promise', () => {
      const tagName = 'trans-async-' + Math.random().toString(36).substring(2, 9)
      const AsyncComp = createCoraliteClass({
        componentId: 'trans-async',
        attributes: {
          data: {
            transform: async (val) => val
          }
        }
      })
      customElements.define(tagName, AsyncComp)

      const el = document.createElement(tagName)
      el.setAttribute('data', 'test')

      assert.throws(() => {
        document.body.appendChild(el)
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "trans-async" attribute "data" transform function must be synchronous. Use getters or server() for asynchronous data.')
        return true
      })
    })

    it('records runtime exception thrown inside transform in state.errors and error_* tokens', () => {
      const tagName = 'trans-err-' + Math.random().toString(36).substring(2, 9)
      const ErrComp = createCoraliteClass({
        componentId: 'trans-err',
        attributes: {
          count: {
            transform: (val) => {
              throw new Error('Custom transformation error')
            }
          }
        }
      })
      customElements.define(tagName, ErrComp)

      const el = document.createElement(tagName)
      el.setAttribute('count', '10')
      document.body.appendChild(el)

      assert.strictEqual(el._state.errors.count, 'Custom transformation error')
      assert.strictEqual(el._state.error_count, 'Custom transformation error')
      assert.strictEqual(el._state.count, '10')

      document.body.removeChild(el)
    })
  })

  describe('Client Runtime Reactivity', () => {
    it('applies transform on setAttribute and updates state symmetrically', () => {
      const tagName = 'trans-client-' + Math.random().toString(36).substring(2, 9)
      const ClientComp = createCoraliteClass({
        componentId: 'trans-client',
        attributes: {
          tags: {
            type: String,
            transform: (val) => String(val).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          }
        }
      })
      customElements.define(tagName, ClientComp)

      const el = document.createElement(tagName)
      document.body.appendChild(el)

      el.setAttribute('tags', ' JS,   CSS , HTML ')
      assert.deepEqual(el._state.tags, ['js', 'css', 'html'])

      document.body.removeChild(el)
    })

    it('applies transform on reactive proxy state setters (state.prop = ...)', () => {
      const tagName = 'trans-setter-' + Math.random().toString(36).substring(2, 9)
      const SetterComp = createCoraliteClass({
        componentId: 'trans-setter',
        attributes: {
          count: {
            type: Number,
            transform: (val) => Math.max(0, Math.min(100, val))
          }
        }
      })
      customElements.define(tagName, SetterComp)

      const el = document.createElement(tagName)
      document.body.appendChild(el)

      el._state.count = 150
      assert.strictEqual(el._state.count, 100)

      el._state.count = -20
      assert.strictEqual(el._state.count, 0)

      document.body.removeChild(el)
    })

    it('handles attribute removal (removeAttribute)', () => {
      const tagName = 'trans-remove-' + Math.random().toString(36).substring(2, 9)
      const RemoveComp = createCoraliteClass({
        componentId: 'trans-remove',
        attributes: {
          title: {
            type: String,
            default: '  Default Title  ',
            transform: (val) => String(val).trim()
          },
          reqAttr: {
            type: String,
            required: true
          }
        }
      })
      customElements.define(tagName, RemoveComp)

      const el = document.createElement(tagName)
      el.setAttribute('req-attr', 'val')
      document.body.appendChild(el)

      assert.strictEqual(el._state.title, 'Default Title')

      el.setAttribute('title', '  New Title  ')
      assert.strictEqual(el._state.title, 'New Title')

      el.removeAttribute('title')
      assert.strictEqual(el._state.title, 'Default Title')

      // Removing a required attribute records error in state.errors
      el.removeAttribute('req-attr')
      assert.strictEqual(el._state.errors.reqAttr, 'Attribute "reqAttr" is required.')
      assert.strictEqual(el._state.error_reqAttr, 'Attribute "reqAttr" is required.')

      document.body.removeChild(el)
    })
  })
})
