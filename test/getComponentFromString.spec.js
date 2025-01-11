import { strictEqual, fail, deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getComponentFromString } from '../lib/index.js'

describe('getComponentFromString', function () {
  it('should correctly extract templates from HTML', function () {
    const html = `<template id="template1">Template 1</template>`
    const component = getComponentFromString(html)

    strictEqual(component.content, 'Template 1')
    strictEqual(component.id, 'template1')
  })

  it('should correctly extract properties from template', function () {
    const html = `<template id="template1">Hello {{ name }}! <code>import { name } from 'lib.js'</code></template>`
    const component = getComponentFromString(html)

    strictEqual(component.id, 'template1')
    strictEqual(component.content, `Hello {{ name }}! <code>import { name } from 'lib.js'</code>`)
    deepStrictEqual(component.tokens, [
      {
        name: 'name',
        startIndex: 6,
        endIndex: 16
      }
    ])
  })

  it('should throw an error when no id attribute is found on a template tag', function () {
    const html = '<template>Template Without ID</template>'

    try {
      getComponentFromString(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'No template found')
    }
  })

  it('should throw an error when there are multiple templates found', function () {
    const html = `
      <template id="template1">Template 1</template>
      <template id="template2">Template 2</template>
    `
    const component = getComponentFromString(html)

    strictEqual(component.content, 'Template 1')
    strictEqual(component.id, 'template1')
  })

  it('should correctly extract script tag', { skip: true }, function () {
    const html = `
      <template id="template1">Template 1</template>
      <script>

      </script>
    `

    try {
      getComponentFromString(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'Unexpected number of templates found, only one is permitted')
    }
  })
})
