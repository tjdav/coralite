import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createExecutionError } from '../../../../../lib/utils/server/errors.js'

describe('utils/server/errors.js', () => {
  describe('createExecutionError', () => {
    it('should handle import errors safely (ReDoS check)', () => {
      const module = {
        id: 'test-id',
        script: 'import { foo } from "bar"',
        lineOffset: 0
      }
      const moduleComponent = { path: { pathname: '/test.html' } }
      const page = { file: { pathname: '/page.html' } }

      const error = new Error("module 'foo' does not provide an export named 'bar'")
      const result = createExecutionError(error, module, moduleComponent, page, 'instance-id')

      assert.strictEqual(result.message, "module 'foo' does not provide an export named 'bar'")
    })

    it('should correctly extract module and export name', () => {
      const script = "import { bar } from 'foo'"
      const module = {
        id: 'test-id',
        script,
        lineOffset: 0
      }
      const moduleComponent = { path: { pathname: '/test.html' } }
      const page = { file: { pathname: '/page.html' } }

      const error = new Error("module 'foo' does provide an export named 'bar'")
      // Manually set message to what we expect to match
      error.message = "module 'foo' does not provide an export named 'bar'"
      // Clear stack to ensure it doesn't get line/column from there
      error.stack = ''

      const result = createExecutionError(error, module, moduleComponent, page, 'instance-id')

      assert.strictEqual(result.line, 1)
      assert.strictEqual(result.column, script.indexOf('bar') + 1)
    })

    it('should correctly extract stack trace info', () => {
      const module = {
        id: 'test-id',
        script: '',
        lineOffset: 0
      }
      const moduleComponent = { path: { pathname: '/test.html' } }
      const page = { file: { pathname: '/page.html' } }

      const error = new Error('Some error')
      error.stack = 'Error: Some error\n    at someFunction (/some/path/to/file.js:10:20)'

      const result = createExecutionError(error, module, moduleComponent, page, 'instance-id')

      assert.strictEqual(result.stackFile, '/some/path/to/file.js')
      assert.strictEqual(result.line, 10)
      assert.strictEqual(result.column, 20)
    })

    it('should be resilient to long input in stack traces', () => {
      const module = {
        id: 'test-id',
        script: '',
        lineOffset: 0
      }
      const moduleComponent = { path: { pathname: '/test.html' } }
      const page = { file: { pathname: '/page.html' } }

      const error = new Error('Some error')
      // Long string that doesn't match the end pattern to test backtracking
      error.stack = 'Error: Some error\n    at (' + 'a'.repeat(10000)

      const startTime = Date.now()
      createExecutionError(error, module, moduleComponent, page, 'instance-id')
      const duration = Date.now() - startTime
      assert.ok(duration < 100)
    })
  })
})
