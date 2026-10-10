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

  describe('createExecutionError stack variants', () => {
    const module = {
      id: 'test',
      script: '',
      lineOffset: 0
    }
    const moduleComponent = { path: { pathname: '/test.html' } }

    it('should handle stack trace with bare path (no parentheses)', () => {
      const error = new Error('fail')
      error.stack = 'Error: fail\n    at /path/to/file.js:42:10'

      const result = createExecutionError(error, module, moduleComponent, null, 'inst')
      assert.strictEqual(result.stackFile, '/path/to/file.js')
      assert.strictEqual(result.line, 42)
      assert.strictEqual(result.column, 10)
    })

    it('should handle node:internal/vm/module stack trace', () => {
      const error = new Error('fail')
      error.stack = 'Error: fail\n    at (node:internal/vm/module:1:2)'

      const result = createExecutionError(error, { ...module, script: '' }, { path: { pathname: '/real/path.html' } }, null, 'inst')
      assert.strictEqual(result.stackFile, '/real/path.html')
      assert.strictEqual(result.line, undefined)
    })

    it('should handle SyntaxError and recover position via re-parse', () => {
      const script = 'const x ='
      const error = new SyntaxError('Unexpected token')
      error.stack = ''

      const result = createExecutionError(error, { ...module, script, lineOffset: 10 }, moduleComponent, null, 'inst')
      assert.strictEqual(result.line, 11)
      assert.strictEqual(result.column, 10)
    })

    it('should handle errors with lineNumber property (non-standard)', () => {
      const error = new SyntaxError('fail')
      error.stack = ''
      // @ts-ignore
      error.lineNumber = 2
      // @ts-ignore
      error.columnNumber = 3

      const result = createExecutionError(error, { ...module, lineOffset: 5 }, moduleComponent, null, 'inst')
      assert.strictEqual(result.line, 7)
      assert.strictEqual(result.column, 3)
    })
  })
})
