import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { normalizeFunction } from '#lib'

describe('normalizeFunction', () => {
  describe('Arrow Functions - should return as-is', () => {
    it('simple arrow function', () => {
      const fn = () => 'value'
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '() => \'value\'')
    })

    it('arrow function with parameters', () => {
      const fn = (a, b) => a + b
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '(a, b) => a + b')
    })

    it('arrow function with single parameter', () => {
      const fn = x => x * 2
      const result = normalizeFunction(fn)
      assert.strictEqual(result, 'x => x * 2')
    })

    it('arrow function returning object', () => {
      const fn = () => ({ key: 'value' })
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '() => ({ key: \'value\' })')
    })

    it('arrow function with block body', () => {
      const fn = (x) => {
        return x * 2
      }
      const result = normalizeFunction(fn)
      assert.match(result, /\(x\) => \{/)
    })

    it('async arrow function', () => {
      const fn = async () => 'value'
      const result = normalizeFunction(fn)
      assert.strictEqual(result, 'async () => \'value\'')
    })

    it('async arrow function with parameters', () => {
      const fn = async (a, b) => a + b
      const result = normalizeFunction(fn)
      assert.strictEqual(result, 'async (a, b) => a + b')
    })
  })

  describe('Standard Function Declarations - should return as-is', () => {
    it('regular function declaration', () => {
      function foo () {
        return 1
      }
      const result = normalizeFunction(foo)
      assert.strictEqual(result, 'function foo () {\n        return 1\n      }')
    })

    it('async function declaration', () => {
      async function bar () {
        return 2
      }
      const result = normalizeFunction(bar)
      assert.strictEqual(result, 'async function bar () {\n        return 2\n      }')
    })

    it('function with parameters', () => {
      function add (a, b) {
        return a + b
      }
      const result = normalizeFunction(add)
      assert.strictEqual(result, 'function add (a, b) {\n        return a + b\n      }')
    })

    it('function with default parameters', () => {
      function greet (name = 'world') {
        return `Hello ${name}`
      }
      const result = normalizeFunction(greet)
      assert.strictEqual(result, 'function greet (name = \'world\') {\n        return `Hello ${name}`\n      }')
    })
  })

  describe('Method Shorthand - should convert to standard function', () => {
    it('sync method shorthand', () => {
      const obj = {
        method () {
          return 1
        }
      }
      const result = normalizeFunction(obj.method)
      assert.strictEqual(result, 'function method() {\n          return 1\n        }')
    })

    it('async method shorthand', () => {
      const obj = {
        async method () {
          return 2
        }
      }
      const result = normalizeFunction(obj.method)
      assert.strictEqual(result, 'async function method() {\n          return 2\n        }')
    })

    it('method with parameters', () => {
      const obj = {
        multiply (a, b) {
          return a * b
        }
      }
      const result = normalizeFunction(obj.multiply)
      assert.strictEqual(result, 'function multiply(a, b) {\n          return a * b\n        }')
    })

    it('method with destructured parameters', () => {
      const obj = {
        sum ({ a, b }) {
          return a + b
        }
      }
      const result = normalizeFunction(obj.sum)
      assert.strictEqual(result, 'function sum({ a, b }) {\n          return a + b\n        }')
    })

    it('method with rest parameters', () => {
      const obj = {
        sum (...args) {
          return args.reduce((a, b) => a + b, 0)
        }
      }
      const result = normalizeFunction(obj.sum)
      assert.strictEqual(result, 'function sum(...args) {\n          return args.reduce((a, b) => a + b, 0)\n        }')
    })
  })

  describe('Getters and Setters - should return as-is', () => {
    it('sync getter', () => {
      const obj = {
        get value () {
          return this._value
        }
      }
      // Getters are accessed as properties, so we need to get the descriptor
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'value')
      const result = normalizeFunction(descriptor.get)
      assert.strictEqual(result, 'get value () {\n          return this._value\n        }')
    })

    it('sync setter', () => {
      const obj = {
        set value (v) {
          this._value = v
        }
      }
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'value')
      const result = normalizeFunction(descriptor.set)
      assert.strictEqual(result, 'set value (v) {\n          this._value = v\n        }')
    })
  })

  describe('Edge Cases', () => {
    it('function with $ in name', () => {
      const obj = {
        $private () {
          return 'private'
        }
      }
      const result = normalizeFunction(obj.$private)
      assert.strictEqual(result, 'function $private() {\n          return \'private\'\n        }')
    })

    it('async method with $ in name', () => {
      const obj = {
        async $private () {
          return 'private'
        }
      }
      const result = normalizeFunction(obj.$private)
      assert.strictEqual(result, 'async function $private() {\n          return \'private\'\n        }')
    })

    it('function with underscore in name', () => {
      const obj = {
        private_method () {
          return 'private'
        }
      }
      const result = normalizeFunction(obj.private_method)
      assert.strictEqual(result, 'function private_method() {\n          return \'private\'\n        }')
    })

    it('arrow function with complex body', () => {
      const fn = (x) => {
        const y = x * 2
        return y + 1
      }
      const result = normalizeFunction(fn)
      assert.match(result, /\(x\) => \{/)
      assert.match(result, /const y = x \* 2/)
      assert.match(result, /return y \+ 1/)
    })

    it('function with comments', () => {
      function withComments () {
        // This is a comment
        return 42
      }
      const result = normalizeFunction(withComments)
      assert.match(result, /\/\/ This is a comment/)
      assert.match(result, /return 42/)
    })

    it('generator function', () => {
      function* generator () {
        yield 1
        yield 2
      }
      const result = normalizeFunction(generator)
      assert.match(result, /function\* generator/)
    })

    it('async generator function', () => {
      async function* asyncGenerator () {
        yield 1
        yield 2
      }
      const result = normalizeFunction(asyncGenerator)
      assert.match(result, /async function\* asyncGenerator/)
    })

    it('function with complex default parameters', () => {
      function complex (
        a = 1,
        b = { nested: { value: 2 } },
        c = [1, 2, 3]
      ) {
        return a + b.nested.value + c.length
      }
      const result = normalizeFunction(complex)
      // The function preserves the original formatting
      assert.match(result, /function complex \(/)
      assert.match(result, /a = 1/)
      assert.match(result, /b = \{ nested: \{ value: 2 \} \}/)
      assert.match(result, /c = \[1, 2, 3\]/)
    })

    it('arrow function with destructured parameters', () => {
      const fn = ({ a, b }) => a + b
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '({ a, b }) => a + b')
    })

    it('method with async arrow in body', () => {
      const obj = {
        async method () {
          const fn = async (x) => x * 2
          return await fn(5)
        }
      }
      const result = normalizeFunction(obj.method)
      assert.match(result, /async function method\(\)/)
      // The inner arrow function should not be affected
      assert.match(result, /async \(x\) => x \* 2/)
    })

    it('function with multiple lines and indentation', () => {
      function indented () {
        if (true) {
          return 'yes'
        } else {
          return 'no'
        }
      }
      const result = normalizeFunction(indented)
      // The function preserves the original formatting
      assert.match(result, /function indented \(/)
      assert.match(result, /if \(true\)/)
      assert.match(result, /return 'yes'/)
    })
  })

  describe('Input Validation', () => {
    it('handles function with no name', () => {
      const fn = function () {
        return 1
      }
      const result = normalizeFunction(fn)
      assert.match(result, /function \(\)/)
    })

    it('handles arrow function with no params', () => {
      const fn = () => 1
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '() => 1')
    })

    it('handles empty function body', () => {
      function empty () {
      }
      const result = normalizeFunction(empty)
      assert.strictEqual(result, 'function empty () {\n      }')
    })

    it('handles arrow function with empty body', () => {
      const fn = () => {
      }
      const result = normalizeFunction(fn)
      assert.strictEqual(result, '() => {\n      }')
    })
  })
})
