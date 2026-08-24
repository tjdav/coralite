import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { executeAttributeValidator, validateAttributeValue, createCoraliteClass, normalizeErrorMessage } from '../../../lib/coralite-element.js'
import { normalizeAndValidateAttributes, createComponentDefinition } from '../../../lib/component-setup.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('Component Attribute validate Feature', () => {
  describe('Definition-Time Validation', () => {
    it('throws CoraliteError if validate property is not a function', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          score: { type: Number, validate: 'not-a-function' }
        }, 'test-comp')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "test-comp" attribute "score" validate property must be a function.')
        return true
      })
    })

    it('validates default value with validate function at definition time and throws if invalid', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          score: {
            type: Number,
            default: -10,
            validate: (val) => val >= 0 || 'Score must be non-negative'
          }
        }, 'test-comp')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('Score must be non-negative'))
        return true
      })
    })

    it('passes definition time validation when default value satisfies validate function', () => {
      const normalized = normalizeAndValidateAttributes({
        score: {
          type: Number,
          default: 10,
          validate: (val) => val >= 0
        }
      }, 'test-comp')

      assert.strictEqual(normalized.score.default, 10)
      assert.strictEqual(typeof normalized.score.validate, 'function')
    })
  })

  describe('Validation Return Value Semantics & Promises', () => {
    it('passes validation when validate returns true, undefined, or void', () => {
      const schemaTrue = { validate: (v) => v > 0 }
      assert.strictEqual(executeAttributeValidator(5, schemaTrue, 'count', 'comp-a'), 5)

      const schemaVoid = { validate: (v) => { if (v < 0) throw new Error('invalid') } }
      assert.strictEqual(executeAttributeValidator(5, schemaVoid, 'count', 'comp-a'), 5)
    })

    it('throws default CoraliteError when validate returns false', () => {
      const schema = { validate: (v) => v > 10 }
      assert.throws(() => {
        executeAttributeValidator(5, schema, 'count', 'comp-a')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "comp-a" attribute "count" validation failed for value 5.')
        return true
      })
    })

    it('throws CoraliteError with custom string message when validate returns a string', () => {
      const schema = { validate: (v) => v % 2 === 0 || 'Value must be an even integer' }
      assert.throws(() => {
        executeAttributeValidator(7, schema, 'count', 'comp-a')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "comp-a" attribute "count" validation failed: Value must be an even integer.')
        return true
      })
    })

    it('wraps thrown Error inside validate in CoraliteError preserving and normalizing error message', () => {
      const schema = {
        validate: () => {
          throw new Error('Custom range exception')
        }
      }

      assert.throws(() => {
        executeAttributeValidator(100, schema, 'range', 'comp-a')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "comp-a" attribute "range" validation failed: Custom range exception.')
        return true
      })
    })

    it('normalizes error messages consistently with normalizeErrorMessage helper', () => {
      assert.strictEqual(normalizeErrorMessage('No punctuation'), 'No punctuation.')
      assert.strictEqual(normalizeErrorMessage('Already ends with period.'), 'Already ends with period.')
      assert.strictEqual(normalizeErrorMessage('Exclamation mark!'), 'Exclamation mark!')
      assert.strictEqual(normalizeErrorMessage('Question mark?'), 'Question mark?')
      assert.strictEqual(normalizeErrorMessage('  trimmed whitespace   '), 'trimmed whitespace.')
      assert.strictEqual(normalizeErrorMessage(''), '')
      assert.strictEqual(normalizeErrorMessage(null), '')
    })

    it('formats error messages consistently across validate returned strings and thrown errors (punctuation matrix)', () => {
      // Returned string with exclamation mark !
      const schemaReturnExclamation = { validate: () => 'Invalid value!' }
      assert.throws(() => executeAttributeValidator(1, schemaReturnExclamation, 'test', 'comp-a'), (err) => {
        assert.strictEqual(err.message, 'Component "comp-a" attribute "test" validation failed: Invalid value!')
        return true
      })

      // Returned string with question mark ?
      const schemaReturnQuestion = { validate: () => 'Did you mean admin?' }
      assert.throws(() => executeAttributeValidator(1, schemaReturnQuestion, 'test', 'comp-a'), (err) => {
        assert.strictEqual(err.message, 'Component "comp-a" attribute "test" validation failed: Did you mean admin?')
        return true
      })

      // Returned string without terminal punctuation
      const schemaReturnNoPunct = { validate: () => 'Invalid format' }
      assert.throws(() => executeAttributeValidator(1, schemaReturnNoPunct, 'test', 'comp-a'), (err) => {
        assert.strictEqual(err.message, 'Component "comp-a" attribute "test" validation failed: Invalid format.')
        return true
      })

      // Thrown error with exclamation mark !
      const schemaThrowExclamation = { validate: () => { throw new Error('Out of bounds!') } }
      assert.throws(() => executeAttributeValidator(1, schemaThrowExclamation, 'test', 'comp-a'), (err) => {
        assert.strictEqual(err.message, 'Component "comp-a" attribute "test" validation failed: Out of bounds!')
        return true
      })

      // Thrown error without terminal punctuation
      const schemaThrowNoPunct = { validate: () => { throw new Error('Out of bounds') } }
      assert.throws(() => executeAttributeValidator(1, schemaThrowNoPunct, 'test', 'comp-a'), (err) => {
        assert.strictEqual(err.message, 'Component "comp-a" attribute "test" validation failed: Out of bounds.')
        return true
      })
    })

    it('throws CoraliteError when validate returns a Promise', () => {
      const schema = {
        validate: async (v) => v > 0
      }

      assert.throws(() => {
        executeAttributeValidator(10, schema, 'count', 'comp-a')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "comp-a" attribute "count" validate function must be synchronous. Use getters or server() for asynchronous validation.')
        return true
      })
    })
  })

  describe('Pipeline Coordination & Omission Handling', () => {
    it('executes in strict sequence: required -> coerce -> transform -> values -> validate', () => {
      const executionOrder = []

      const schema = {
        type: Number,
        required: true,
        transform: (val) => {
          executionOrder.push(`transform:${val}`)
          return val * 2
        },
        values: [20, 40, 60],
        validate: (val) => {
          executionOrder.push(`validate:${val}`)
          return val === 40
        }
      }

      const result = validateAttributeValue('20', schema, 'level', 'pipeline-comp')

      assert.strictEqual(result, 40)
      assert.deepEqual(executionOrder, ['transform:20', 'validate:40'])
    })

    it('bypasses validate when optional attribute without default is omitted', () => {
      let validateCalled = false
      const schema = {
        type: Number,
        validate: () => {
          validateCalled = true
          return true
        }
      }

      const result = validateAttributeValue(undefined, schema, 'opt', 'comp-b')
      assert.strictEqual(result, undefined)
      assert.strictEqual(validateCalled, false)
    })

    it('runs validate on default value when optional attribute with default is omitted', () => {
      let validatedValue = null
      const schema = {
        type: Number,
        default: 5,
        validate: (v) => {
          validatedValue = v
          return v > 0
        }
      }

      const result = validateAttributeValue(undefined, schema, 'opt', 'comp-b')
      assert.strictEqual(result, 5)
      assert.strictEqual(validatedValue, 5)
    })
  })

  describe('SSR & Client Runtime Integration', () => {
    it('SSR createComponentDefinition captures validate errors in state.errors and error_* tokens', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const validContext = {
        state: { age: '25' },
        module: { id: 'user-card', path: { pathname: '/user.coral' } },
        root: null
      }

      const validResult = await defineComponent({
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be an adult'
          }
        }
      }, validContext)

      assert.strictEqual(validResult.age, 25)
      assert.strictEqual(validResult.errors.age, undefined)

      const invalidContext = {
        state: { age: '15' },
        module: { id: 'user-card', path: { pathname: '/user.coral' } },
        root: null
      }

      const invalidResult = await defineComponent({
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be an adult'
          }
        }
      }, invalidContext)

      assert.strictEqual(invalidResult.errors.age, 'Must be an adult.')
      assert.strictEqual(invalidResult.error_age, 'Must be an adult.')
      assert.strictEqual(invalidResult.age, 15)
    })

    it('SSR createComponentDefinition dispatches app.onError with type "attribute_validation" when validation fails', async () => {
      const errorsReported = []
      const mockApp = {
        createComponentElement: () => null,
        options: { mode: 'development' },
        onError: (errData) => {
          errorsReported.push(errData)
        }
      }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const invalidContext = {
        state: { age: '15' },
        module: { id: 'user-card', path: { pathname: '/user.coral' } },
        root: null
      }

      await defineComponent({
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be an adult'
          }
        }
      }, invalidContext)

      assert.strictEqual(errorsReported.length, 1)
      assert.strictEqual(errorsReported[0].level, 'WARN')
      assert.strictEqual(errorsReported[0].type, 'attribute_validation')
      assert.strictEqual(errorsReported[0].componentId, 'user-card')
      assert.ok(errorsReported[0].message.includes('Component "user-card" attribute "age" validation failed: Must be an adult.'))
    })

    it('SSR createComponentDefinition always calls app.onError regardless of suppression settings when provided', async () => {
      const errorsReported = []
      const mockApp = {
        createComponentElement: () => null,
        options: { suppressValidationWarnings: true, mode: 'development' },
        onError: (errData) => {
          errorsReported.push(errData)
        }
      }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const invalidContext = {
        state: { age: '15' },
        module: { id: 'user-card', path: { pathname: '/user.coral' } },
        root: null
      }

      await defineComponent({
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be an adult'
          }
        }
      }, invalidContext)

      assert.strictEqual(errorsReported.length, 1)
      assert.strictEqual(errorsReported[0].level, 'WARN')
      assert.strictEqual(errorsReported[0].type, 'attribute_validation')

      // Test mode: 'production'
      const prodApp = {
        createComponentElement: () => null,
        options: { mode: 'production' },
        onError: (errData) => {
          errorsReported.push(errData)
        }
      }
      const defineProdComponent = createComponentDefinition({ app: prodApp })

      await defineProdComponent({
        attributes: {
          age: {
            type: Number,
            validate: (v) => v >= 18 || 'Must be an adult'
          }
        }
      }, invalidContext)

      assert.strictEqual(errorsReported.length, 2)
      assert.strictEqual(errorsReported[1].level, 'WARN')
      assert.strictEqual(errorsReported[1].type, 'attribute_validation')
    })

    it('SSR createComponentDefinition console.warn fallback is suppressed when suppressValidationWarnings is true or mode is production', async () => {
      const originalWarn = console.warn
      const warningsCaptured = []
      console.warn = (msg) => {
        warningsCaptured.push(msg)
      }

      try {
        const mockAppSuppressed = {
          createComponentElement: () => null,
          options: { suppressValidationWarnings: true, mode: 'development' }
        }
        const defineComponentSuppressed = createComponentDefinition({ app: mockAppSuppressed })

        const invalidContext = {
          state: { age: '15' },
          module: { id: 'user-card', path: { pathname: '/user.coral' } },
          root: null
        }

        await defineComponentSuppressed({
          attributes: {
            age: {
              type: Number,
              validate: (v) => v >= 18 || 'Must be an adult'
            }
          }
        }, invalidContext)

        assert.strictEqual(warningsCaptured.length, 0)

        const mockAppProd = {
          createComponentElement: () => null,
          options: { mode: 'production' }
        }
        const defineComponentProd = createComponentDefinition({ app: mockAppProd })

        await defineComponentProd({
          attributes: {
            age: {
              type: Number,
              validate: (v) => v >= 18 || 'Must be an adult'
            }
          }
        }, invalidContext)

        assert.strictEqual(warningsCaptured.length, 0)

        const mockAppDev = {
          createComponentElement: () => null,
          options: { mode: 'development' }
        }
        const defineComponentDev = createComponentDefinition({ app: mockAppDev })

        await defineComponentDev({
          attributes: {
            age: {
              type: Number,
              validate: (v) => v >= 18 || 'Must be an adult'
            }
          }
        }, invalidContext)

        assert.strictEqual(warningsCaptured.length, 1)
        assert.ok(warningsCaptured[0].includes('Component "user-card" attribute "age" validation failed: Must be an adult.'))
      } finally {
        console.warn = originalWarn
      }
    })

    it('Client runtime CoraliteElement updates state.errors and error_* tokens on invalid setAttribute and proxy mutations', () => {
      const tagName = 'val-comp-' + Math.random().toString(36).substring(2, 9)
      const ValElement = createCoraliteClass({
        componentId: 'val-comp',
        attributes: {
          count: {
            type: Number,
            default: 10,
            validate: (v) => v <= 100 || 'Count cannot exceed 100'
          }
        }
      })
      customElements.define(tagName, ValElement)

      const el = document.createElement(tagName)
      document.body.appendChild(el)
      assert.strictEqual(el._state.count, 10)

      el.setAttribute('count', '50')
      assert.strictEqual(el._state.count, 50)
      assert.strictEqual(el._state.error_count, '')

      el.setAttribute('count', '150')
      assert.strictEqual(el._state.errors.count, 'Count cannot exceed 100.')
      assert.strictEqual(el._state.error_count, 'Count cannot exceed 100.')
      assert.strictEqual(el._state.count, 150)

      // Reactive proxy state property mutation
      el._state.count = 80
      assert.strictEqual(el._state.count, 80)
      assert.strictEqual(el._state.error_count, '')

      el._state.count = 200
      assert.strictEqual(el._state.errors.count, 'Count cannot exceed 100.')
      assert.strictEqual(el._state.error_count, 'Count cannot exceed 100.')
      assert.strictEqual(el._state.count, 200)

      document.body.removeChild(el)
    })
  })
})
