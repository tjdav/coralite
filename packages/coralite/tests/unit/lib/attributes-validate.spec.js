import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { executeAttributeValidator, validateAttributeValue, createCoraliteClass } from '../../../lib/coralite-element.js'
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

    it('wraps thrown Error inside validate in CoraliteError preserving error message', () => {
      const schema = {
        validate: () => {
          throw new Error('Custom range exception')
        }
      }

      assert.throws(() => {
        executeAttributeValidator(100, schema, 'range', 'comp-a')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Component "comp-a" attribute "range" validation failed: Custom range exception')
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
    it('SSR createComponentDefinition runs validate on incoming state attributes', async () => {
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

      const invalidContext = {
        state: { age: '15' },
        module: { id: 'user-card', path: { pathname: '/user.coral' } },
        root: null
      }

      await assert.rejects(async () => {
        await defineComponent({
          attributes: {
            age: {
              type: Number,
              validate: (v) => v >= 18 || 'Must be an adult'
            }
          }
        }, invalidContext)
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('Must be an adult'))
        return true
      })
    })

    it('Client runtime CoraliteElement validates setAttribute and reactive proxy state mutations', () => {
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

      assert.throws(() => {
        el.setAttribute('count', '150')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('Count cannot exceed 100'))
        return true
      })

      // Reactive proxy state property mutation
      el._state.count = 80
      assert.strictEqual(el._state.count, 80)

      assert.throws(() => {
        el._state.count = 200
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('Count cannot exceed 100'))
        return true
      })

      document.body.removeChild(el)
    })
  })
})
