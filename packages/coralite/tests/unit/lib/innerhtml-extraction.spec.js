
import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findAndExtractScript } from '../../../lib/utils/server/server.js'

describe('InnerHTML Support Extraction', () => {
  test('innerHTML assignment transformation', () => {
    const code = `
defineComponent({
  client(context) {
    const el = document.createElement('div')
    el.innerHTML = '<toast-message>Hello</toast-message>'
  }
})`
    const result = findAndExtractScript(code)
    assert.match(result.content, /el\.innerHTML = processHTML\('<toast-message>Hello<\/toast-message>', context\.id\)/)
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
    assert.match(result.content, /el\.outerHTML = processHTML\('<custom-element><\/custom-element>', context\.id\)/)
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
    assert.match(result.content, /el\.insertAdjacentHTML\('beforeend', processHTML\('<my-comp><\/my-comp>', context\.id\)\)/)
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
    assert.match(result.content, /document\.body\.innerHTML = processHTML\(`\s*<greet-ing name="\${name}"><\/greet-ing>\s*`, context\.id\)/)
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
    assert.match(result.content, /document\.body\.innerHTML = processHTML\(myHtml, context\.id\)/)
    // components list should be empty because 'myHtml' is a variable,
    // unless the variable assignment is also tracked, but we currently only track literals in findHTMLComponents
  })
})
