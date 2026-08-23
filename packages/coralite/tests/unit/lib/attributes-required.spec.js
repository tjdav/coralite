import '../setup.js'
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { normalizeAndValidateAttributes, createComponentDefinition } from '../../../lib/component-setup.js'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('Required Component Attributes', () => {
  describe('Definition & Schema Validation', () => {
    it('throws error if required: true and default are both specified on primitive type attribute', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          title: { type: String, required: true, default: 'Hello' }
        }, 'test-comp')
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "test-comp" attribute "title" cannot be marked as required and define a default value.'
      })
    })

    it('throws error if required: true and default are both specified on values-constrained attribute', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          status: { values: ['active', 'inactive'], required: true, default: 'active' }
        }, 'test-comp')
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "test-comp" attribute "status" cannot be marked as required and define a default value.'
      })
    })

    it('normalizes required: true property correctly', () => {
      const normalized = normalizeAndValidateAttributes({
        title: { type: String, required: true },
        status: { values: ['active', 'inactive'], required: true },
        optional: { type: String }
      }, 'test-comp')

      assert.strictEqual(normalized.title.required, true)
      assert.strictEqual(normalized.status.required, true)
      assert.strictEqual(normalized.optional.required, false)
    })
  })

  describe('SSR / Build Time Validation', () => {
    let mockApp
    let defineComponent

    beforeEach(() => {
      mockApp = { createComponentElement: () => null, options: {} }
      defineComponent = createComponentDefinition({ app: mockApp })
    })

    it('initializes state successfully when required attribute is provided during SSR', async () => {
      const context = {
        state: { username: 'jules' },
        module: { id: 'user-badge', path: { pathname: '/user-badge.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          username: { type: String, required: true }
        }
      }, context)

      assert.strictEqual(result.username, 'jules')
    })

    it('throws CoraliteError when required attribute is omitted in SSR', async () => {
      const context = {
        state: {},
        module: { id: 'user-badge', path: { pathname: '/user-badge.coral' } },
        root: null
      }

      await assert.rejects(async () => {
        await defineComponent({
          attributes: {
            username: { type: String, required: true }
          }
        }, context)
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "user-badge" requires attribute "username", but it was not provided.'
      })
    })

    it('treats empty string attribute as provided and satisfying required check in SSR', async () => {
      const context = {
        state: { username: '' },
        module: { id: 'user-badge', path: { pathname: '/user-badge.coral' } },
        root: null
      }

      const result = await defineComponent({
        attributes: {
          username: { type: String, required: true }
        }
      }, context)

      assert.strictEqual(result.username, '')
    })
  })

  describe('Client Runtime Validation', () => {
    let ElementClass
    let element

    beforeEach(() => {
      ElementClass = createCoraliteClass({
        componentId: 'my-card',
        attributes: {
          title: { type: String, required: true },
          badge: { values: ['new', 'sale'], required: true },
          subtitle: { type: String }
        },
        defaultValues: { title: undefined, badge: undefined, subtitle: undefined },
        templateHTML: '<div><h1>{{ title }}</h1><span>{{ badge }}</span></div>'
      })
      if (!customElements.get('my-card')) {
        customElements.define('my-card', ElementClass)
      }
    })

    afterEach(() => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element)
      }
    })

    it('mounts custom element successfully when all required attributes are provided in DOM', () => {
      element = document.createElement('my-card')
      element.setAttribute('title', 'Header Title')
      element.setAttribute('badge', 'new')
      document.body.appendChild(element)

      assert.strictEqual(element._state.title, 'Header Title')
      assert.strictEqual(element._state.badge, 'new')
    })

    it('throws CoraliteError on mount if a required attribute is missing', () => {
      element = document.createElement('my-card')
      element.setAttribute('title', 'Header Title')
      // badge missing

      assert.throws(() => {
        document.body.appendChild(element)
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "my-card" requires attribute "badge", but it was not provided.'
      })
    })

    it('throws CoraliteError when removeAttribute() is called on a required attribute', () => {
      element = document.createElement('my-card')
      element.setAttribute('title', 'Header Title')
      element.setAttribute('badge', 'new')
      document.body.appendChild(element)

      assert.throws(() => {
        element.removeAttribute('title')
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "my-card" attribute "title" is required and cannot be removed.'
      })
    })

    it('throws CoraliteError when state property for required attribute is mutated to undefined or null', () => {
      element = document.createElement('my-card')
      element.setAttribute('title', 'Header Title')
      element.setAttribute('badge', 'new')
      document.body.appendChild(element)

      assert.throws(() => {
        element._state.title = undefined
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "my-card" attribute "title" is required and cannot be set to undefined.'
      })

      assert.throws(() => {
        element._state.title = null
      }, (err) => {
        return err instanceof CoraliteError && err.message === 'Component "my-card" attribute "title" is required and cannot be set to null.'
      })
    })
  })
})
