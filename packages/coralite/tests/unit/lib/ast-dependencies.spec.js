
import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findAndExtractScript } from '../../../lib/utils/server/server.js'

describe('AST Dependency Tracking', () => {
  test('tracks dependencies from variable declarators', () => {
    const code = `
defineComponent({
  client() {
    const tag = 'my-component';
    document.createElement(tag);
  }
})`
    const result = findAndExtractScript(code)
    assert.deepStrictEqual(result.components.sort(), ['my-component'])
  })

  test('tracks dependencies from ternary operators', () => {
    const code = `
defineComponent({
  client() {
    const isRed = true;
    const tag = isRed ? 'red-button' : 'blue-button';
    document.createElement(tag);
  }
})`
    const result = findAndExtractScript(code)
    assert.deepStrictEqual(result.components.sort(), ['blue-button', 'red-button'])
  })

  test('handles nested scopes for variable lookup', () => {
    const code = `
defineComponent({
  client() {
    const tag = 'outer-comp';
    {
      const tag = 'inner-comp';
      document.createElement(tag);
    }
    document.createElement(tag);
  }
})`
    const result = findAndExtractScript(code)
    assert.deepStrictEqual(result.components.sort(), ['inner-comp', 'outer-comp'])
  })

  test('bails out on complex concatenations but does not crash', () => {
    const code = `
defineComponent({
  client() {
    const prefix = 'my-';
    document.createElement(prefix + 'component');
  }
})`
    const result = findAndExtractScript(code)
    // Should not find anything for the dynamic part, but should not crash
    assert.deepStrictEqual(result.components, [])
  })

  test('tracks dependencies from createCoraliteElement', () => {
    const code = `
defineComponent({
  client() {
    const tag = 'coral-comp';
    createCoraliteElement(tag);
  }
})`
    const result = findAndExtractScript(code)
    assert.deepStrictEqual(result.components.sort(), ['coral-comp'])
  })
})
