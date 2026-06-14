import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  createCoraliteElement,
  createCoraliteTextNode,
  createCoraliteComment,
  createCoraliteDirective,
  createCoraliteComponent,
  relinkChildren,
  enhanceNode
} from '../../../lib/utils/server/dom.js'

describe('DOM Coverage Gaps', () => {
  it('should handle parentElement setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const parent = createCoraliteElement({ name: 'span' })
    el.parentElement = parent
    assert.strictEqual(el.parent, parent)
    assert.strictEqual(el.parentElement, parent)
  })

  it('should handle tagName setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    el.tagName = 'P'
    assert.strictEqual(el.name, 'p')
    assert.strictEqual(el.tagName, 'P')
  })

  it('should handle nodeValue for elements (no-op)', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.strictEqual(el.nodeValue, null)
    el.nodeValue = 'test'
    assert.strictEqual(el.nodeValue, null)
  })

  it('should handle attributes setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const attribs = { id: 'test' }
    el.attributes = attribs
    assert.strictEqual(el.attribs, attribs)
  })

  it('should handle childNodes getter/setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const children = [createCoraliteTextNode({ data: 'hi' })]
    el.childNodes = children
    assert.strictEqual(el.children, children)
    assert.deepStrictEqual(el.childNodes, children)
  })

  it('should handle firstChild and lastChild', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.strictEqual(el.firstChild, null)
    assert.strictEqual(el.lastChild, null)

    const child1 = createCoraliteTextNode({ data: '1' })
    const child2 = createCoraliteTextNode({ data: '2' })
    el.appendChild(child1)
    el.appendChild(child2)

    assert.strictEqual(el.firstChild, child1)
    assert.strictEqual(el.lastChild, child2)
  })

  it('should handle textContent with no children', () => {
    const el = createCoraliteElement({ name: 'div' })
    el.children = null
    assert.strictEqual(el.textContent, '')
  })

  it('should handle empty id and className', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.strictEqual(el.id, '')
    assert.strictEqual(el.className, '')
  })

  it('should handle classList with force toggle', () => {
    const el = createCoraliteElement({ name: 'div' })
    el.classList.toggle('a', true)
    assert.strictEqual(el.className, 'a')
    el.classList.toggle('a', true)
    assert.strictEqual(el.className, 'a')
    el.classList.toggle('a', false)
    assert.strictEqual(el.className, '')
    el.classList.toggle('a', false)
    assert.strictEqual(el.className, '')
  })

  it('should handle classList.value', () => {
    const el = createCoraliteElement({
      name: 'div',
      attribs: { class: 'a b' }
    })
    assert.strictEqual(el.classList.value, 'a b')
  })

  it('should handle TextNode nodeValue and textContent setter', () => {
    const text = createCoraliteTextNode({ data: 'old' })
    text.nodeValue = 'new1'
    assert.strictEqual(text.data, 'new1')
    text.textContent = 'new2'
    assert.strictEqual(text.data, 'new2')
  })

  it('should handle Comment nodeValue and textContent setter', () => {
    const comment = createCoraliteComment({ data: 'old' })
    comment.nodeValue = 'new1'
    assert.strictEqual(comment.data, 'new1')
    comment.textContent = 'new2'
    assert.strictEqual(comment.data, 'new2')
  })

  it('should handle Directive nodes', () => {
    const directive = createCoraliteDirective({
      name: '!DOCTYPE',
      data: 'html'
    })
    assert.strictEqual(directive.nodeName, '!DOCTYPE')
    assert.strictEqual(directive.nodeValue, 'html')
    directive.nodeValue = 'HTML'
    assert.strictEqual(directive.data, 'HTML')
  })

  it('should handle Component root childNodes, firstChild, lastChild and textContent', () => {
    const root = createCoraliteComponent({ children: [] })
    assert.strictEqual(root.nodeName, '#document')
    assert.strictEqual(root.nodeValue, null)
    assert.deepStrictEqual(root.childNodes, [])
    assert.strictEqual(root.firstChild, null)
    assert.strictEqual(root.lastChild, null)
    assert.strictEqual(root.textContent, null)

    const child = createCoraliteElement({ name: 'html' })
    root.childNodes = [child]
    assert.strictEqual(root.firstChild, child)
    assert.strictEqual(root.lastChild, child)
  })

  it('should handle relinkChildren', () => {
    const parent = {
      type: 'tag',
      name: 'div',
      children: [
        {
          type: 'text',
          data: '1'
        },
        {
          type: 'tag',
          name: 'span',
          children: [{
            type: 'text',
            data: '2'
          }]
        }
      ]
    }
    relinkChildren(parent)

    assert.ok(parent.children[0].__coralite_enhanced__)
    assert.strictEqual(parent.children[0].parent, parent)
    assert.strictEqual(parent.children[0].next, parent.children[1])

    assert.ok(parent.children[1].children[0].__coralite_enhanced__)
    assert.strictEqual(parent.children[1].children[0].parent, parent.children[1])
  })

  it('should skip enhancing already enhanced nodes', () => {
    const node = createCoraliteElement({ name: 'div' })
    const protoBefore = Object.getPrototypeOf(node)
    enhanceNode(node)
    assert.strictEqual(Object.getPrototypeOf(node), protoBefore)
  })

  it('should handle default prototype for unknown types', () => {
    const node = enhanceNode({ type: 'unknown' })
    assert.strictEqual(node.nodeType, 1)
  })
})
