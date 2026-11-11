import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  transformImperativeComponents,
  findAndExtractImperativeComponents
} from '../../../../lib/server/utils/server.js'

describe('transformImperativeComponents', () => {
  it('rewrites document.createElement for custom elements and collects tags', () => {
    const result = transformImperativeComponents(
      'function () { const el = document.createElement("x-widget"); return el }'
    )

    assert.match(result.code, /createCoraliteElement\("x-widget"\)/)
    assert.doesNotMatch(result.code, /document\.createElement\("x-widget"\)/)
    assert.deepEqual(result.components, ['x-widget'])
  })

  it('leaves built-in element creation untouched', () => {
    const result = transformImperativeComponents(
      'function () { return document.createElement("div") }'
    )

    assert.match(result.code, /document\.createElement\("div"\)/)
    assert.deepEqual(result.components, [])
  })

  it('rewrites dynamic tag creation and resolves identifier values', () => {
    const result = transformImperativeComponents(`
      function () {
        const tag = 'x-dynamic'
        return document.createElement(tag)
      }
    `)

    assert.match(result.code, /createCoraliteElement\(tag\)/)
    assert.deepEqual(result.components, ['x-dynamic'])
  })

  it('uses processHTMLTarget for simple unscoped HTML insertion targets', () => {
    const result = transformImperativeComponents(`
      function init () {
        const container = document.getElementById('mount')
        container.innerHTML = '<x-widget></x-widget>'
      }
    `)

    assert.match(result.code, /container\.innerHTML = processHTMLTarget\(container, '<x-widget><\/x-widget>'\)/)
    assert.deepEqual(result.components, ['x-widget'])
  })

  it('falls back to unscoped processHTML for complex HTML insertion targets', () => {
    const result = transformImperativeComponents(`
      function init () {
        document.getElementById('mount').innerHTML = '<x-widget></x-widget>'
      }
    `)

    assert.match(result.code, /processHTML\('<x-widget><\/x-widget>'\)/)
    assert.doesNotMatch(result.code, /processHTMLTarget/)
    assert.deepEqual(result.components, ['x-widget'])
  })

  it('scopes phase-2 context HTML insertion with the instance parameter', () => {
    const result = transformImperativeComponents(`
      () => (localContext) => ({
        render (container) {
          container.innerHTML = '<x-widget></x-widget>'
        }
      })
    `, { instanceScope: 'context' })

    assert.match(result.code, /processHTML\('<x-widget><\/x-widget>', localContext\.instanceId\)/)
    assert.deepEqual(result.components, ['x-widget'])
  })

  it('scopes destructured phase-2 context HTML insertion', () => {
    const result = transformImperativeComponents(`
      () => ({ instanceId }) => ({
        render (container) {
          container.innerHTML = '<x-widget></x-widget>'
        }
      })
    `, { instanceScope: 'context' })

    assert.match(result.code, /processHTML\('<x-widget><\/x-widget>', instanceId\)/)
  })

  it('injects an instance binding when phase-2 destructuring omits it', () => {
    const result = transformImperativeComponents(`
      () => ({ root }) => ({
        render (container) {
          container.innerHTML = '<x-widget></x-widget>'
        }
      })
    `, { instanceScope: 'context' })

    assert.match(result.code, /instanceId: _coralite_pluginInstanceId,/)
    assert.match(result.code, /processHTML\('<x-widget><\/x-widget>', _coralite_pluginInstanceId\)/)
  })

  it('scopes hook HTML insertion with the hook payload instanceId', () => {
    const result = transformImperativeComponents(`
      function hook (hookContext) {
        hookContext.root.innerHTML = '<x-widget></x-widget>'
      }
    `, { instanceScope: 'hook' })

    assert.match(result.code, /processHTML\('<x-widget><\/x-widget>', hookContext\.instanceId\)/)
  })

  it('rewrites insertAdjacentHTML with the resolved instance scope', () => {
    const result = transformImperativeComponents(`
      () => (localContext) => ({
        render (container) {
          container.insertAdjacentHTML('beforeend', '<x-widget></x-widget>')
        }
      })
    `, { instanceScope: 'context' })

    assert.match(result.code, /insertAdjacentHTML\('beforeend', processHTML\('<x-widget><\/x-widget>', localContext\.instanceId\)\)/)
  })

  it('preserves source when parsing fails', () => {
    const code = 'function broken ('
    const result = transformImperativeComponents(code)

    assert.equal(result.code, code)
    assert.deepEqual(result.components, [])
  })
})

describe('findAndExtractImperativeComponents', () => {
  it('delegates to the transformer and returns collected tags', () => {
    const components = findAndExtractImperativeComponents(`
      function client ({ root }) {
        const child = document.createElement('x-child')
        root.innerHTML = '<x-html></x-html>'
        root.insertAdjacentHTML('beforeend', '<x-adjacent></x-adjacent>')
        return child
      }
    `)

    assert.deepEqual(components.sort(), ['x-adjacent', 'x-child', 'x-html'])
  })
})
