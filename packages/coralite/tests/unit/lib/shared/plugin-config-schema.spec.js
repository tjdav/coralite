import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAndValidateConfigSchemaKey,
  validatePluginConfigBlocks
} from '../../../../lib/shared/plugin-config-schema.js'

describe('plugin-config-schema.js', () => {
  describe('normalizeAndValidateConfigSchemaKey', () => {
    it('should normalize shorthand constructors (String, Number, Boolean, Object, Array)', () => {
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('strKey', String), { type: 'String' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('numKey', Number), { type: 'Number' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('boolKey', Boolean), { type: 'Boolean' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('objKey', Object), { type: 'Object' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('arrKey', Array), { type: 'Array' })
    })

    it('should normalize string constructor names', () => {
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('strKey', 'String'), { type: 'String' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('numKey', 'Number'), { type: 'Number' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('boolKey', 'Boolean'), { type: 'Boolean' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('objKey', 'Object'), { type: 'Object' })
      assert.deepStrictEqual(normalizeAndValidateConfigSchemaKey('arrKey', 'Array'), { type: 'Array' })
    })

    it('should normalize shorthand enum array form', () => {
      assert.deepStrictEqual(
        normalizeAndValidateConfigSchemaKey('mode', ['history', 'hash']),
        {
          type: 'String',
          values: ['history', 'hash']
        }
      )
      assert.deepStrictEqual(
        normalizeAndValidateConfigSchemaKey('ports', [80, 443]),
        {
          type: 'Number',
          values: [80, 443]
        }
      )
    })

    it('should accept full object form with type, default, required, values, transform, validate', () => {
      const transformFn = (val) => String(val).toLowerCase()
      const validateFn = (val) => val.length > 0

      const fullSchema = {
        type: String,
        default: 'hello',
        required: true,
        values: ['hello', 'world'],
        transform: transformFn,
        validate: validateFn
      }

      const result = normalizeAndValidateConfigSchemaKey('greeting', fullSchema)
      assert.deepStrictEqual(result, {
        type: 'String',
        default: 'hello',
        required: true,
        values: ['hello', 'world'],
        transform: transformFn,
        validate: validateFn
      })
    })

    it('should infer type from values array if type property is omitted', () => {
      const result = normalizeAndValidateConfigSchemaKey('mode', {
        values: ['history', 'hash'],
        default: 'history'
      })
      assert.deepStrictEqual(result, {
        type: 'String',
        default: 'history',
        values: ['history', 'hash']
      })
    })

    it('should throw CORALITE-P206 for missing type when values is also absent', () => {
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', { default: 'test' }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('Missing required "type"')
      )
    })

    it('should throw CORALITE-P206 for unknown or unsupported type string or class', () => {
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', { type: 'foo' }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('Unknown or unsupported type "foo"')
      )
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', { type: Date }),
        (err) => err.message.includes('CORALITE-P206')
      )
    })

    it('should throw CORALITE-P206 for non-primitive default value on primitive type', () => {
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', {
          type: String,
          default: { a: 1 }
        }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('non-primitive default value')
      )
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', {
          type: Number,
          default: [1, 2]
        }),
        (err) => err.message.includes('CORALITE-P206')
      )
    })

    it('should throw CORALITE-P206 for malformed property types in schema object', () => {
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', {
          type: String,
          values: 'not-an-array'
        }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('values" must be an array')
      )
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', {
          type: String,
          transform: 'not-a-fn'
        }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('transform" must be a function')
      )
      assert.throws(
        () => normalizeAndValidateConfigSchemaKey('badKey', {
          type: String,
          validate: 123
        }),
        (err) => err.message.includes('CORALITE-P206') && err.message.includes('validate" must be a function')
      )
    })
  })

  describe('validatePluginConfigBlocks', () => {
    it('should validate valid disjoint config blocks', () => {
      const result = validatePluginConfigBlocks({
        pluginName: 'router',
        config: {
          base: {
            type: String,
            default: '/'
          },
          mode: ['history', 'hash']
        },
        serverConfig: {
          apiKey: {
            type: String,
            required: true
          }
        },
        clientConfig: {
          prefetch: {
            type: Boolean,
            default: true
          }
        }
      })

      assert.deepStrictEqual(result.config.base, {
        type: 'String',
        default: '/'
      })
      assert.deepStrictEqual(result.config.mode, {
        type: 'String',
        values: ['history', 'hash']
      })
      assert.deepStrictEqual(result.serverConfig.apiKey, {
        type: 'String',
        required: true
      })
      assert.deepStrictEqual(result.clientConfig.prefetch, {
        type: 'Boolean',
        default: true
      })
    })

    it('should throw CORALITE-P203 when key is declared in config and server.config', () => {
      assert.throws(
        () => validatePluginConfigBlocks({
          pluginName: 'dup-plugin',
          config: {
            apiKey: String
          },
          serverConfig: {
            apiKey: String
          }
        }),
        (err) => err.message.includes('CORALITE-P203') && err.message.includes('apiKey')
      )
    })

    it('should throw CORALITE-P203 when key is declared in server.config and client.config', () => {
      assert.throws(
        () => validatePluginConfigBlocks({
          pluginName: 'dup-plugin',
          serverConfig: {
            theme: String
          },
          clientConfig: {
            theme: String
          }
        }),
        (err) => err.message.includes('CORALITE-P203') && err.message.includes('theme')
      )
    })
  })
})
