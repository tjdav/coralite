import { bench } from 'mitata'
import { replaceToken } from '../../../lib/utils/server/server.js'

/**
 *
 */
export function setupTokenInterpolationBench () {
  const dummyTextNode = {
    type: 'text',
    data: 'Hello {{ name }}, welcome to {{ site }}!',
    parent: { children: [] }
  }

  const dummyAttrNode = {
    type: 'tag',
    name: 'div',
    attribs: {
      title: 'Greeting {{ name }}'
    }
  }

  bench('Coralite Token Replace (textNode)', () => {
    const node = { ...dummyTextNode }
    replaceToken({
      type: 'textNode',
      node,
      content: '{{ name }}',
      value: 'World'
    })
  })

  bench('Native String.prototype.replace (regex)', () => {
    let str = 'Hello {{ name }}, welcome to {{ site }}!'
    str = str.replace(/\{\{\s*name\s*\}\}/g, 'World')
  })

  bench('Coralite Token Replace (attribute)', () => {
    const node = {
      type: 'tag',
      name: 'div',
      attribs: { title: 'Greeting {{ name }}' }
    }
    replaceToken({
      type: 'attribute',
      node,
      attribute: 'title',
      content: '{{ name }}',
      value: 'World'
    })
  })
}
