import assert from 'node:assert'
import { describe, it } from 'node:test'
import { convertEsmToCjs } from '../../../lib/utils.js'

describe('convertEsmToCjs', () => {
  describe('Imports', () => {
    it('should convert named imports', () => {
      const input = `import { foo, bar } from 'baz';`
      const output = convertEsmToCjs(input)
      assert.match(output, /const { foo, bar } = require\("baz"\);/)
    })

    it('should convert default imports', () => {
      const input = `import foo from 'bar';`
      const output = convertEsmToCjs(input)
      // Expect intermediate variable to handle .default interop
      assert.match(output, /const _req_foo = require\("bar"\);/)
      assert.match(output, /const foo = _req_foo.default \|\| _req_foo;/)
    })

    it('should convert namespace imports', () => {
      const input = `import * as foo from 'bar';`
      const output = convertEsmToCjs(input)
      assert.match(output, /const foo = require\("bar"\);/)
    })

    it('should convert side-effect imports', () => {
      const input = `import 'foo';`
      const output = convertEsmToCjs(input)
      assert.match(output, /require\("foo"\);/)
    })
  })

  describe('Exports', () => {
    it('should convert export default', () => {
      const input = `export default { foo: 'bar' };`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.default = { foo: 'bar' };/)
    })

    it('should convert export default function', () => {
      const input = `export default function foo() {}`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.default = function foo\(\) {}/)
    })

    it('should convert named export block', () => {
      const input = `export { foo, bar };`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.foo = foo;/)
      assert.match(output, /module\.exports\.bar = bar;/)
    })

    it('should convert named export block with alias', () => {
      const input = `export { foo as bar };`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.bar = foo;/)
    })

    it('should convert export const variable', () => {
      const input = `export const foo = 'bar';`
      const output = convertEsmToCjs(input)
      // Expect: const foo = module.exports.foo = 'bar';
      assert.match(output, /const foo = module\.exports\.foo = 'bar';/)
    })

    it('should convert export let variable', () => {
      const input = `export let count = 0;`
      const output = convertEsmToCjs(input)
      assert.match(output, /let count = module\.exports\.count = 0;/)
    })

    it('should convert export function declaration', () => {
      const input = `export function foo() {}`
      const output = convertEsmToCjs(input)
      // Expect: module.exports.foo = function foo() {}
      assert.match(output, /module\.exports\.foo = function foo\(\) {}/)
    })

    it('should convert export async function declaration', () => {
      const input = `export async function fetchData() {}`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.fetchData = async function fetchData\(\) {}/)
    })

    it('should convert export class declaration', () => {
      const input = `export class MyClass {}`
      const output = convertEsmToCjs(input)
      assert.match(output, /module\.exports\.MyClass = class MyClass {}/)
    })
  })

  describe('Integration', () => {
    it('should handle mixed imports and exports', () => {
      const input = `
        import foo from 'foo';
        export const bar = 1;
        export default function() { return foo; }
      `
      const output = convertEsmToCjs(input)

      assert.ok(output.includes('require("foo")'))
      assert.ok(output.includes('module.exports.bar ='))
      assert.ok(output.includes('module.exports.default ='))
    })
  })
})
