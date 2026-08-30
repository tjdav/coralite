import { bench, do_not_optimize } from 'mitata'
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

  // Warmup V8 JIT compiler for replaceToken
  for (let i = 0; i < 1000; i++) {
    replaceToken({
      type: 'textNode',
      node: { ...dummyTextNode },
      content: '{{ name }}',
      value: 'World'
    })
  }

  bench('Coralite Token Replace (textNode)', () => {
    const node = { ...dummyTextNode }
    replaceToken({
      type: 'textNode',
      node,
      content: '{{ name }}',
      value: 'World'
    })
    return do_not_optimize(node.data)
  })

  bench('Native String.prototype.replace (regex)', () => {
    let str = 'Hello {{ name }}, welcome to {{ site }}!'
    str = str.replace(/\{\{\s*name\s*\}\}/g, 'World')
    return do_not_optimize(str)
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
    return do_not_optimize(node.attribs.title)
  })
}
