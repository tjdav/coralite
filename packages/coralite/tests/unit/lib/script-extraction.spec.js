
import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findAndExtractScript } from '../../../lib/utils.js'

describe('Script Extraction', () => {
  test('shorthand method', () => {
    const code = `
defineComponent({
  client: {
    script(context) {
      console.log('shorthand')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `function script(context) {
      console.log('shorthand')
    }`)
  })

  test('async shorthand method', () => {
    const code = `
defineComponent({
  client: {
    async script(context) {
      console.log('async shorthand')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `async function script(context) {
      console.log('async shorthand')
    }`)
  })

  test('arrow function', () => {
    const code = `
defineComponent({
  client: {
    script: (context) => {
      console.log('arrow')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `(context) => {
      console.log('arrow')
    }`)
  })

  test('async arrow function', () => {
    const code = `
defineComponent({
  client: {
    script: async (context) => {
      console.log('async arrow')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `async (context) => {
      console.log('async arrow')
    }`)
  })

  test('function expression', () => {
    const code = `
defineComponent({
  client: {
    script: function(context) {
      console.log('function expression')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `function(context) {
      console.log('function expression')
    }`)
  })

  test('async function expression', () => {
    const code = `
defineComponent({
  client: {
    script: async function(context) {
      console.log('async function expression')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 3)
    assert.strictEqual(result.content, `async function(context) {
      console.log('async function expression')
    }`)
  })

  test('multi-line definition', () => {
    const code = `
defineComponent({
  client: {
    script: 
      (context) => {
        console.log('multi-line')
      }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 4)
    assert.strictEqual(result.content, `(context) => {
        console.log('multi-line')
      }`)
  })

  test('with comments', () => {
    const code = `
defineComponent({
  client: {
    /**
     * My script
     */
    script(context) {
      console.log('comments')
    }
  }
})`
    const result = findAndExtractScript(code)
    assert.strictEqual(result.lineOffset, 6)
    assert.strictEqual(result.content, `function script(context) {
      console.log('comments')
    }`)
  })
})
