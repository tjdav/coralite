import { bench } from 'mitata'
import { createCoraliteElement, createCoraliteTextNode } from '../../../lib/utils/server/dom.js'

/**
 *
 */
export function setupASTDOMCreationBench () {
  function createLegacyASTElement (name, attribs = {}, children = []) {
    const el = {
      type: 'tag',
      name,
      attribs,
      children
    }
    Object.defineProperties(el, {
      nodeName: {
        get () {
          return (this.name || '').toUpperCase()
        },
        enumerable: false
      },
      tagName: {
        get () {
          return (this.name || '').toUpperCase()
        },
        enumerable: false
      },
      attributes: {
        get () {
          return this.attribs
        },
        enumerable: false
      }
    })
    return el
  }

  bench('Optimized Object.setPrototypeOf AST Element Creation', () => {
    const el = createCoraliteElement({
      name: 'div',
      attribs: {
        class: 'container',
        id: 'main'
      },
      children: []
    })
    const text = createCoraliteTextNode({
      data: 'Hello World'
    })
    el.children.push(text)
  })

  bench('Legacy Object.defineProperties AST Element Creation', () => {
    const el = createLegacyASTElement('div', {
      class: 'container',
      id: 'main'
    }, [])
    const text = {
      type: 'text',
      data: 'Hello World'
    }
    el.children.push(text)
  })
}
