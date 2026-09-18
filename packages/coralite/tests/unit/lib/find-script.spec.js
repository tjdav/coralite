import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findAndExtractScript } from '../../../lib/utils/server/server.js'

describe('findAndExtractScript', () => {
  describe('script extraction & line offsets', () => {
    test('shorthand method', () => {
      const code = `
defineComponent({
  client(context) {
    console.log('shorthand')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `function client(context) {
    console.log('shorthand')
  }`)
    })

    test('async shorthand method', () => {
      const code = `
defineComponent({
  async client(context) {
    console.log('async shorthand')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `async function client(context) {
    console.log('async shorthand')
  }`)
    })

    test('arrow function', () => {
      const code = `
defineComponent({
  client: (context) => {
    console.log('arrow')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `(context) => {
    console.log('arrow')
  }`)
    })

    test('async arrow function', () => {
      const code = `
defineComponent({
  client: async (context) => {
    console.log('async arrow')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `async (context) => {
    console.log('async arrow')
  }`)
    })

    test('function expression', () => {
      const code = `
defineComponent({
  client: function(context) {
    console.log('function expression')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `function(context) {
    console.log('function expression')
  }`)
    })

    test('async function expression', () => {
      const code = `
defineComponent({
  client: async function(context) {
    console.log('async function expression')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 2)
      assert.strictEqual(result.content, `async function(context) {
    console.log('async function expression')
  }`)
    })

    test('multi-line definition', () => {
      const code = `
defineComponent({
  client: 
    (context) => {
      console.log('multi-line')
    }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 3)
      assert.strictEqual(result.content, `(context) => {
      console.log('multi-line')
    }`)
    })

    test('with comments', () => {
      const code = `
defineComponent({
  /**
   * My script
   */
  client(context) {
    console.log('comments')
  }
})`
      const result = findAndExtractScript(code)
      assert.strictEqual(result.lineOffset, 5)
      assert.strictEqual(result.content, `function client(context) {
    console.log('comments')
  }`)
    })

    test('document.createElement transformation', () => {
      const code = `
defineComponent({
  client(context) {
    const el1 = document.createElement('coralite-btn')
    const el2 = document.createElement('div')
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /createCoraliteElement\('coralite-btn'\)/)
      assert.match(result.content, /document\.createElement\('div'\)/)
    })
  })

  describe('AST dependency tracking', () => {
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

  describe('innerHTML/outerHTML processHTML transformation', () => {
    test('innerHTML assignment transformation', () => {
      const code = `
defineComponent({
  client(context) {
    const el = document.createElement('div')
    el.innerHTML = '<toast-message>Hello</toast-message>'
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /el\.innerHTML = processHTML\('<toast-message>Hello<\/toast-message>', context\.instanceId\)/)
      assert.deepStrictEqual(result.components, ['toast-message'])
    })

    test('outerHTML assignment transformation', () => {
      const code = `
defineComponent({
  client(context) {
    const el = document.createElement('div')
    el.outerHTML = '<custom-element></custom-element>'
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /el\.outerHTML = processHTML\('<custom-element><\/custom-element>', context\.instanceId\)/)
      assert.deepStrictEqual(result.components, ['custom-element'])
    })

    test('insertAdjacentHTML call transformation', () => {
      const code = `
defineComponent({
  client(context) {
    const el = document.createElement('div')
    el.insertAdjacentHTML('beforeend', '<my-comp></my-comp>')
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /el\.insertAdjacentHTML\('beforeend', processHTML\('<my-comp><\/my-comp>', context\.instanceId\)\)/)
      assert.deepStrictEqual(result.components, ['my-comp'])
    })

    test('template literal support', () => {
      const code = `
defineComponent({
  client(context) {
    const name = 'world'
    document.body.innerHTML = \`<greet-ing name="\${name}"></greet-ing>\`
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /document\.body\.innerHTML = processHTML\(`\s*<greet-ing name="\${name}"><\/greet-ing>\s*`, context\.instanceId\)/)
      assert.deepStrictEqual(result.components, ['greet-ing'])
    })

    test('dynamic variable transformation', () => {
      const code = `
defineComponent({
  client(context) {
    const myHtml = '<dynamic-comp></dynamic-comp>'
    document.body.innerHTML = myHtml
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /document\.body\.innerHTML = processHTML\(myHtml, context\.instanceId\)/)
      // components list should be empty because 'myHtml' is a variable,
      // unless the variable assignment is also tracked, but we currently only track literals in findHTMLComponents
    })

    test('destructured instanceId transformation', () => {
      const code = `
defineComponent({
  client({ instanceId }) {
    const el = document.createElement('div')
    el.innerHTML = '<toast-message>Hello</toast-message>'
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /el\.innerHTML = processHTML\('<toast-message>Hello<\/toast-message>', instanceId\)/)
      assert.deepStrictEqual(result.components, ['toast-message'])
    })

    test('method shorthand this._instanceId transformation', () => {
      const code = `
defineComponent({
  client() {
    const el = document.createElement('div')
    el.innerHTML = '<toast-message>Hello</toast-message>'
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /el\.innerHTML = processHTML\('<toast-message>Hello<\/toast-message>', this\._instanceId\)/)
      assert.deepStrictEqual(result.components, ['toast-message'])
    })

    test('destructured without instanceId transformation', () => {
      const code = `
defineComponent({
  client({ refs }) {
    const el = document.createElement('div')
    el.innerHTML = '<toast-message>Hello</toast-message>'
  }
})`
      const result = findAndExtractScript(code)
      assert.match(result.content, /client\(\{instanceId: _coralite_instanceId,\s*refs\s*\}\)/)
      assert.match(result.content, /el\.innerHTML = processHTML\('<toast-message>Hello<\/toast-message>', _coralite_instanceId\)/)
      assert.deepStrictEqual(result.components, ['toast-message'])
    })
  })
})