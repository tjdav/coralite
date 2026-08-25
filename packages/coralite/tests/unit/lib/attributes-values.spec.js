import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { inferTypeFromValues, validateAttributeValue, createCoraliteClass } from '../../../lib/coralite-element.js'
import { normalizeAndValidateAttributes, createComponentDefinition } from '../../../lib/component-setup.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('Component Attribute values & Validation', () => {
  describe('Helpers & Coercion', () => {
    it('inferTypeFromValues infers primitive constructors correctly', () => {
      assert.strictEqual(inferTypeFromValues([1, 2, 3]), Number)
      assert.strictEqual(inferTypeFromValues([true, false]), Boolean)
      assert.strictEqual(inferTypeFromValues(['sm', 'md', 'lg']), String)
      assert.strictEqual(inferTypeFromValues(['auto', 100]), String)
      assert.strictEqual(inferTypeFromValues([]), String)
    })

    it('validateAttributeValue allows direct primitive matches', () => {
      const schema = { values: ['primary', 'secondary'] }
      assert.strictEqual(validateAttributeValue('primary', schema, 'variant', 'my-btn'), 'primary')
      assert.strictEqual(validateAttributeValue('secondary', schema, 'variant', 'my-btn'), 'secondary')
    })

    it('validateAttributeValue coerces string inputs for numeric and boolean allowed values', () => {
      const numSchema = { values: [0, 10, 20, 30] }
      assert.strictEqual(validateAttributeValue('20', numSchema, 'level', 'meter-box'), 20)
      assert.strictEqual(validateAttributeValue('0', numSchema, 'level', 'meter-box'), 0)

      const boolSchema = { values: [true, false] }
      assert.strictEqual(validateAttributeValue('true', boolSchema, 'active', 'toggle-btn'), true)
      assert.strictEqual(validateAttributeValue('false', boolSchema, 'active', 'toggle-btn'), false)
    })

    it('coerces empty/whitespace strings to null for type: Number to prevent false matches against 0', () => {
      const numSchema = { type: Number, values: [0, 10, 20] }
      assert.throws(() => {
        validateAttributeValue('', numSchema, 'count', 'comp')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Invalid value null for attribute "count" in component "comp". Expected one of: 0, 10, 20.')
        return true
      })

      assert.throws(() => {
        validateAttributeValue('   ', numSchema, 'count', 'comp')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Invalid value null for attribute "count" in component "comp". Expected one of: 0, 10, 20.')
        return true
      })
    })

    it('evaluates boolean matrix correctly for type: Boolean across string, null, and undefined inputs', () => {
      const boolSchema = { type: Boolean }
      assert.strictEqual(validateAttributeValue('true', boolSchema, 'disabled', 'comp'), true)
      assert.strictEqual(validateAttributeValue('false', boolSchema, 'disabled', 'comp'), false)
      assert.strictEqual(validateAttributeValue('', boolSchema, 'disabled', 'comp'), true)
      assert.strictEqual(validateAttributeValue(null, boolSchema, 'disabled', 'comp'), false)
      assert.strictEqual(validateAttributeValue(undefined, boolSchema, 'disabled', 'comp'), undefined)

      const boolWithDefault = { type: Boolean, default: true }
      assert.strictEqual(validateAttributeValue(undefined, boolWithDefault, 'disabled', 'comp'), true)
      assert.strictEqual(validateAttributeValue(null, boolWithDefault, 'disabled', 'comp'), false)
    })

    it('validateAttributeValue handles undefined and null values', () => {
      const schemaWithDefault = { values: ['a', 'b'], default: 'a' }
      assert.strictEqual(validateAttributeValue(undefined, schemaWithDefault, 'prop', 'comp'), 'a')
      assert.strictEqual(validateAttributeValue(null, schemaWithDefault, 'prop', 'comp'), 'a')

      const schemaNoDefault = { values: ['a', 'b'] }
      assert.strictEqual(validateAttributeValue(undefined, schemaNoDefault, 'prop', 'comp'), undefined)
      assert.strictEqual(validateAttributeValue(null, schemaNoDefault, 'prop', 'comp'), undefined)
    })

    it('validateAttributeValue throws CoraliteError for invalid values with formatted message', () => {
      const strSchema = { values: ['primary', 'secondary', 'danger'] }
      assert.throws(() => {
        validateAttributeValue('invalid', strSchema, 'variant', 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Invalid value "invalid" for attribute "variant" in component "my-btn". Expected one of: "primary", "secondary", "danger".')
        return true
      })

      const numSchema = { values: [10, 20, 30] }
      assert.throws(() => {
        validateAttributeValue(50, numSchema, 'level', 'meter-box')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Invalid value 50 for attribute "level" in component "meter-box". Expected one of: 10, 20, 30.')
        return true
      })

      const boolSchema = { values: [true, false] }
      assert.throws(() => {
        validateAttributeValue('maybe', boolSchema, 'active', 'toggle-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'Invalid value "maybe" for attribute "active" in component "toggle-btn". Expected one of: true, false.')
        return true
      })
    })
  })

  describe('Component Definition-Time Validation', () => {
    it('supports array shorthand syntax and deduplicates values', () => {
      const normalized = normalizeAndValidateAttributes({
        size: ['sm', 'md', 'lg', 'sm']
      }, 'my-btn')

      assert.deepEqual(normalized.size, {
        type: 'String',
        default: undefined,
        values: ['sm', 'md', 'lg'],
        required: false
      })
    })

    it('throws error when values is non-array or empty', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          size: { values: 'not-an-array' }
        }, 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('values must be an Array'))
        return true
      })

      assert.throws(() => {
        normalizeAndValidateAttributes({
          size: { values: [] }
        }, 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('values array cannot be empty'))
        return true
      })
    })

    it('throws error when values contains non-primitive items', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          size: { values: ['sm', null, {}] }
        }, 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('contains non-primitive item'))
        return true
      })
    })

    it('throws error when default value is not in values list', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          variant: { values: ['primary', 'secondary'], default: 'danger' }
        }, 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('default value "danger" is not in allowed values'))
        return true
      })
    })

    it('blocks Object and Array constructors on attributes', () => {
      assert.throws(() => {
        normalizeAndValidateAttributes({
          data: Object
        }, 'my-btn')
      }, (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('Object and Array types are blocked'))
        return true
      })
    })
  })

  describe('Server-Side Rendering (SSR)', () => {
    it('validates incoming attributes during createComponentDefinition and captures errors gracefully', async () => {
      const mockApp = { createComponentElement: () => null, options: {} }
      const defineComponent = createComponentDefinition({ app: mockApp })

      const validContext = {
        state: { variant: 'primary' },
        module: { id: 'btn-comp', path: { pathname: '/btn.coral' } },
        root: null
      }

      const validResult = await defineComponent({
        attributes: {
          variant: ['primary', 'secondary']
        }
      }, validContext)

      assert.strictEqual(validResult.variant, 'primary')

      const invalidContext = {
        state: { variant: 'invalid' },
        module: { id: 'btn-comp', path: { pathname: '/btn.coral' } },
        root: null
      }

      const invalidResult = await defineComponent({
        attributes: {
          variant: ['primary', 'secondary']
        }
      }, invalidContext)

      assert.strictEqual(invalidResult.errors.variant, "Invalid value for attribute \"variant\". Expected one of: 'primary', 'secondary'.")
      assert.strictEqual(invalidResult.error_variant, "Invalid value for attribute \"variant\". Expected one of: 'primary', 'secondary'.")
      assert.strictEqual(invalidResult.variant, 'invalid')
    })
  })

  describe('Client Runtime (CoraliteElement)', () => {
    it('validates initial attributes on custom element mount', () => {
      const tagName = 'values-mount-' + Math.random().toString(36).substring(2, 9)
      const MountComp = createCoraliteClass({
        componentId: 'values-mount',
        attributes: {
          variant: { values: ['primary', 'secondary'], default: 'primary' }
        }
      })
      customElements.define(tagName, MountComp)

      const validEl = document.createElement(tagName)
      validEl.setAttribute('variant', 'secondary')
      document.body.appendChild(validEl)
      assert.strictEqual(validEl._state.variant, 'secondary')
      document.body.removeChild(validEl)

      const invalidEl = document.createElement(tagName)
      invalidEl.setAttribute('variant', 'invalid')
      document.body.appendChild(invalidEl)

      assert.strictEqual(invalidEl._state.errors.variant, "Invalid value for attribute \"variant\". Expected one of: 'primary', 'secondary'.")
      assert.strictEqual(invalidEl._state.error_variant, "Invalid value for attribute \"variant\". Expected one of: 'primary', 'secondary'.")
      assert.strictEqual(invalidEl._state.variant, 'invalid')

      document.body.removeChild(invalidEl)
    })

    it('validates attribute changes via setAttribute and resets state on removeAttribute', () => {
      const tagName = 'values-change-' + Math.random().toString(36).substring(2, 9)
      const ChangeComp = createCoraliteClass({
        componentId: 'values-change',
        attributes: {
          variant: { values: ['primary', 'secondary'], default: 'primary' }
        }
      })
      customElements.define(tagName, ChangeComp)

      const el = document.createElement(tagName)
      document.body.appendChild(el)
      assert.strictEqual(el._state.variant, 'primary')

      el.setAttribute('variant', 'secondary')
      assert.strictEqual(el._state.variant, 'secondary')

      el.setAttribute('variant', 'invalid')
      assert.strictEqual(el._state.errors.variant, "Invalid value for attribute \"variant\". Expected one of: 'primary', 'secondary'.")
      assert.strictEqual(el._state.variant, 'invalid')

      // removeAttribute resets state to default and clears error
      el.removeAttribute('variant')
      assert.strictEqual(el._state.errors.variant, undefined)
      assert.strictEqual(el._state.variant, 'primary')

      document.body.removeChild(el)
    })

    it('validates direct state property mutations via reactive proxy setter', () => {
      const tagName = 'values-state-' + Math.random().toString(36).substring(2, 9)
      const StateComp = createCoraliteClass({
        componentId: 'values-state',
        attributes: {
          level: [1, 2, 3]
        }
      })
      customElements.define(tagName, StateComp)

      const el = document.createElement(tagName)
      document.body.appendChild(el)

      el._state.level = 2
      assert.strictEqual(el._state.level, 2)

      el._state.level = 100
      assert.strictEqual(el._state.errors.level, 'Invalid value for attribute "level". Expected one of: 1, 2, 3.')
      assert.strictEqual(el._state.level, 100)

      document.body.removeChild(el)
    })

    it('supports mixed primitive types array (string | number)', () => {
      const tagName = 'values-mixed-' + Math.random().toString(36).substring(2, 9)
      const MixedComp = createCoraliteClass({
        componentId: 'values-mixed',
        attributes: {
          width: ['auto', 100, 200]
        }
      })
      customElements.define(tagName, MixedComp)

      const el = document.createElement(tagName)
      document.body.appendChild(el)

      el.setAttribute('width', 'auto')
      assert.strictEqual(el._state.width, 'auto')

      el.setAttribute('width', '100')
      assert.strictEqual(el._state.width, 100)

      el.setAttribute('width', '300')
      assert.strictEqual(el._state.errors.width, 'Invalid value for attribute "width". Expected one of: \'auto\', 100, 200.')
      assert.strictEqual(el._state.width, '300')

      document.body.removeChild(el)
    })
  })
})
