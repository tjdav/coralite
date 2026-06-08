import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { CoraliteError, handleError, defaultOnError } from '../../../lib/utils/errors.js'

describe('errors.js', () => {
  describe('CoraliteError', () => {
    it('should create an error with all properties', () => {
      const cause = new Error('Original error')
      const error = new CoraliteError('Coralite error message', {
        cause,
        componentId: 'my-component',
        filePath: '/path/to/component.html',
        instanceId: 'my-instance-1',
        pagePath: '/path/to/page.html',
        line: 10,
        column: 5,
        stackFile: '/path/to/stack.js'
      })

      assert.strictEqual(error.message, 'Coralite error message')
      assert.strictEqual(error.name, 'CoraliteError')
      assert.strictEqual(error.isCoraliteError, true)
      assert.strictEqual(error.cause, cause)
      assert.strictEqual(error.componentId, 'my-component')
      assert.strictEqual(error.filePath, '/path/to/component.html')
      assert.strictEqual(error.instanceId, 'my-instance-1')
      assert.strictEqual(error.pagePath, '/path/to/page.html')
      assert.strictEqual(error.line, 10)
      assert.strictEqual(error.column, 5)
      assert.strictEqual(error.stackFile, '/path/to/stack.js')
    })
  })

  describe('handleError', () => {
    it('should call onErrorCallback with error data', (t) => {
      const onErrorCallback = t.mock.fn()
      const error = new Error('Test error')
      const data = {
        level: 'ERR',
        message: 'Something went wrong',
        error
      }

      handleError({
        onErrorCallback,
        data
      })

      assert.strictEqual(onErrorCallback.mock.callCount(), 1)
      const call = onErrorCallback.mock.calls[0]
      assert.deepStrictEqual(call.arguments[0], data)
    })

    it('should enrich data with CoraliteError properties', (t) => {
      const onErrorCallback = t.mock.fn()
      const coraliteError = new CoraliteError('Coralite error', {
        componentId: 'comp-1',
        filePath: 'file-1'
      })
      const data = {
        level: 'ERR',
        message: 'Error message',
        error: coraliteError
      }

      handleError({
        onErrorCallback,
        data
      })

      assert.strictEqual(onErrorCallback.mock.callCount(), 1)
      const call = onErrorCallback.mock.calls[0]
      assert.strictEqual(call.arguments[0].componentId, 'comp-1')
      assert.strictEqual(call.arguments[0].filePath, 'file-1')
    })

    it('should use defaultOnError if no callback is provided', () => {
      const data = {
        level: 'LOG',
        message: 'Log message'
      }

      // Should not throw
      handleError({ data })
    })
  })

  describe('defaultOnError', () => {
    it('should throw CoraliteError for ERR level', () => {
      assert.throws(() => defaultOnError({
        level: 'ERR',
        message: 'Fatal error'
      }), (err) => {
        return err instanceof CoraliteError && err.message === 'Fatal error'
      })
    })

    it('should throw the original error if provided', () => {
      const originalError = new TypeError('Type mismatch')
      assert.throws(() => defaultOnError({
        level: 'ERR',
        message: 'Fatal error',
        error: originalError
      }), (err) => {
        return err === originalError
      })
    })

    it('should log to console for WARN and LOG levels', (t) => {
      const warnMock = t.mock.method(console, 'warn', () => {
      })
      const logMock = t.mock.method(console, 'log', () => {
      })

      defaultOnError({
        level: 'WARN',
        message: 'Warning message'
      })
      assert.strictEqual(warnMock.mock.callCount(), 1)
      assert.strictEqual(warnMock.mock.calls[0].arguments[0], 'Warning message')

      defaultOnError({
        level: 'LOG',
        message: 'Info message'
      })
      assert.strictEqual(logMock.mock.callCount(), 1)
      assert.strictEqual(logMock.mock.calls[0].arguments[0], 'Info message')
    })
  })
})
