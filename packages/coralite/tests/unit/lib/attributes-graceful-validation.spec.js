import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createComponentDefinition } from '../../../lib/component-setup.js'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('Graceful Attribute Validation & error_* Tokens', () => {
  const dummyApp = {
    options: { mode: 'testing' },
    createComponentElement: () => null
  }

  describe('Server-Side Rendering (createComponentDefinition)', () => {
    it('sets state.errors and error_* tokens without throwing on required attribute omission', async () => {
      const define = createComponentDefinition({ app: dummyApp })
      const module = { id: 'req-comp', path: { pathname: '/req-comp.html' } }
      const context = { state: {}, module }

      const options = {
        attributes: {
          username: { type: String, required: true }
        }
      }

      const result = await define(options, context)
      assert.strictEqual(result.errors.username, 'Attribute "username" is required.')
      assert.strictEqual(result.error_username, 'Attribute "username" is required.')
      assert.strictEqual(result['error_username'], 'Attribute "username" is required.')
      assert.strictEqual(result.username, undefined)
    })

    it('sets state.errors and error_* tokens on values enum mismatch and retains input value', async () => {
      const define = createComponentDefinition({ app: dummyApp })
      const module = { id: 'enum-comp', path: { pathname: '/enum-comp.html' } }
      const context = { state: { role: 'superadmin' }, module }

      const options = {
        attributes: {
          role: ['admin', 'user', 'guest']
        }
      }

      const result = await define(options, context)
      assert.strictEqual(result.errors.role, 'Invalid value for attribute "role". Expected one of: \'admin\', \'user\', \'guest\'.')
      assert.strictEqual(result.error_role, 'Invalid value for attribute "role". Expected one of: \'admin\', \'user\', \'guest\'.')
      assert.strictEqual(result.role, 'superadmin')
    })

    it('sets state.errors and error_* tokens when validate returns false or custom string or throws', async () => {
      const define = createComponentDefinition({ app: dummyApp })
      const module = { id: 'val-comp', path: { pathname: '/val-comp.html' } }
      const context = { state: { age: 15, count: -5, label: 'bad' }, module }

      const options = {
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be at least 18 years old.'
          },
          count: {
            type: Number,
            validate: (v) => v >= 0
          },
          label: {
            type: String,
            validate: () => { throw new Error('Invalid label format') }
          }
        }
      }

      const result = await define(options, context)
      assert.strictEqual(result.errors.age, 'Must be at least 18 years old.')
      assert.strictEqual(result.error_age, 'Must be at least 18 years old.')
      assert.strictEqual(result.age, 15)

      assert.strictEqual(result.errors.count, 'Validation failed for attribute "count".')
      assert.strictEqual(result.error_count, 'Validation failed for attribute "count".')
      assert.strictEqual(result.count, -5)

      assert.strictEqual(result.errors.label, 'Invalid label format.')
      assert.strictEqual(result.error_label, 'Invalid label format.')
      assert.strictEqual(result.label, 'bad')
    })

    it('handles kebab-case attribute names creating both camelCase and kebab-case error_* aliases', async () => {
      const define = createComponentDefinition({ app: dummyApp })
      const module = { id: 'kebab-comp', path: { pathname: '/kebab-comp.html' } }
      const context = { state: { 'user-age': 12 }, module }

      const options = {
        attributes: {
          userAge: {
            type: Number,
            validate: (v) => v >= 18 || 'Underage user.'
          }
        }
      }

      const result = await define(options, context)
      assert.strictEqual(result.errors.userAge, 'Underage user.')
      assert.strictEqual(result.error_userAge, 'Underage user.')
      assert.strictEqual(result['error_user-age'], 'Underage user.')
      assert.strictEqual(result.userAge, 12)
    })
  })

  describe('Client Runtime (CoraliteElement)', () => {
    it('initializes state.errors and error_* tokens on mount without throwing', () => {
      const compOptions = {
        componentId: 'client-val-comp',
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be adult.'
          }
        }
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('client-val-comp', CompClass)

      const el = document.createElement('client-val-comp')
      el.setAttribute('age', '12')
      document.body.appendChild(el)

      assert.strictEqual(el._state.errors.age, 'Must be adult.')
      assert.strictEqual(el._state.error_age, 'Must be adult.')
      assert.strictEqual(el._state.age, 12)

      document.body.removeChild(el)
    })

    it('reactively updates state.errors and error_* tokens on setAttribute and clears when corrected', () => {
      const compOptions = {
        componentId: 'client-reactive-comp',
        attributes: {
          score: {
            type: Number,
            validate: (v) => v >= 50 || 'Score too low.'
          }
        }
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('client-reactive-comp', CompClass)

      const el = document.createElement('client-reactive-comp')
      document.body.appendChild(el)

      el.setAttribute('score', '20')
      assert.strictEqual(el._state.errors.score, 'Score too low.')
      assert.strictEqual(el._state.error_score, 'Score too low.')
      assert.strictEqual(el._state.score, 20)

      el.setAttribute('score', '80')
      assert.strictEqual(el._state.errors.score, undefined)
      assert.strictEqual(Object.keys(el._state.errors).length, 0)
      assert.strictEqual(el._state.error_score, '')
      assert.strictEqual(el._state.score, 80)

      document.body.removeChild(el)
    })

    it('reactively updates state.errors and error_* tokens on proxy mutation (state.prop = ...)', () => {
      const compOptions = {
        componentId: 'client-proxy-comp',
        attributes: {
          email: {
            type: String,
            validate: (v) => (v && v.includes('@')) || 'Invalid email address.'
          }
        }
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('client-proxy-comp', CompClass)

      const el = document.createElement('client-proxy-comp')
      document.body.appendChild(el)

      el._state.email = 'notanemail'
      assert.strictEqual(el._state.errors.email, 'Invalid email address.')
      assert.strictEqual(el._state.error_email, 'Invalid email address.')
      assert.strictEqual(el._state.email, 'notanemail')

      el._state.email = 'test@example.com'
      assert.strictEqual(el._state.errors.email, undefined)
      assert.strictEqual(Object.keys(el._state.errors).length, 0)
      assert.strictEqual(el._state.error_email, '')
      assert.strictEqual(el._state.email, 'test@example.com')

      document.body.removeChild(el)
    })

    it('passes errors directly to client controller context', async () => {
      let capturedErrors
      let capturedStateErrors

      const compOptions = {
        componentId: 'client-ctx-comp',
        attributes: {
          title: {
            type: String,
            required: true
          }
        },
        client: ({ errors, state }) => {
          capturedErrors = errors
          capturedStateErrors = state.errors
        }
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('client-ctx-comp', CompClass)

      const el = document.createElement('client-ctx-comp')
      document.body.appendChild(el)
      await new Promise(resolve => setTimeout(resolve, 10))

      assert.strictEqual(capturedErrors, capturedStateErrors)
      assert.strictEqual(capturedErrors.title, 'Attribute "title" is required.')

      document.body.removeChild(el)
    })

    it('allows getters to read state.errors to derive validity flags', () => {
      const compOptions = {
        componentId: 'getter-comp',
        attributes: {
          code: {
            type: String,
            validate: (v) => (v && v.length === 4) || 'Code must be 4 characters.'
          }
        },
        getters: {
          isValid: (state) => Object.keys(state.errors).length === 0
        }
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('getter-comp', CompClass)

      const el = document.createElement('getter-comp')
      el.setAttribute('code', '12')
      document.body.appendChild(el)

      assert.strictEqual(el._state.errors.code, 'Code must be 4 characters.')
      assert.strictEqual(el._state.isValid, false)

      el.setAttribute('code', '1234')
      assert.strictEqual(el._state.isValid, true)

      document.body.removeChild(el)
    })

    it('does not leak SSR validation errors across consecutive instances sharing component options and defaultValues', async () => {
      const define = createComponentDefinition({ app: dummyApp })
      const module = { id: 'leak-comp', path: { pathname: '/leak-comp.html' } }

      const options = {
        attributes: {
          userAge: {
            type: Number,
            required: true,
            validate: (v) => v >= 18 || 'Underage user.'
          }
        }
      }

      // Instance 1: rendered with invalid attribute value
      const context1 = { state: { userAge: 12 }, module }
      const result1 = await define(options, context1)
      assert.strictEqual(result1.errors.userAge, 'Underage user.')

      // Confirm defaultValues on result1.__script__ does NOT contain errors or error_*
      assert.strictEqual(result1.__script__.defaultValues.errors, undefined)
      assert.strictEqual(result1.__script__.defaultValues.error_userAge, undefined)
      assert.strictEqual(result1.__script__.defaultValues['error_user-age'], undefined)

      // Instance 2: Client runtime instance initialized using defaultValues from component setup
      const compOptions = {
        componentId: 'leak-comp',
        defaultValues: result1.__script__.defaultValues,
        attributes: options.attributes
      }

      const CompClass = createCoraliteClass(compOptions)
      customElements.define('leak-comp', CompClass)

      const el1 = document.createElement('leak-comp')
      el1.setAttribute('user-age', '12')
      document.body.appendChild(el1)

      const el2 = document.createElement('leak-comp')
      el2.setAttribute('user-age', '25')
      document.body.appendChild(el2)

      assert.strictEqual(el1._state.errors.userAge, 'Underage user.')
      assert.strictEqual(el1._state.error_userAge, 'Underage user.')
      assert.strictEqual(el1._state['error_user-age'], 'Underage user.')

      assert.strictEqual(Object.keys(el2._state.errors).length, 0)
      assert.strictEqual(el2._state.error_userAge, '')
      assert.strictEqual(el2._state['error_user-age'], '')

      document.body.removeChild(el1)
      document.body.removeChild(el2)
    })
  })
})
