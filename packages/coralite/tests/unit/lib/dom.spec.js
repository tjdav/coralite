import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  createCoraliteElement,
  createCoraliteTextNode,
  createCoraliteComment,
  createCoraliteComponent,
  createCoraliteDirective,
  enhanceNode,
  relinkChildren
} from '../../../lib/utils/server/dom.js'

describe('createCoraliteElement', () => {
  it('should enhance an element node with DOM state', () => {
    const node = {
      type: 'tag',
      name: 'div',
      attribs: { id: 'test' },
      children: [],
      parent: null
    }

    const coraliteNode = createCoraliteElement(node)

    assert.equal(coraliteNode.tagName, 'DIV')
    assert.equal(coraliteNode.nodeName, 'DIV')
    assert.equal(coraliteNode.nodeType, 1)
    assert.equal(coraliteNode.id, 'test')
    assert.equal(coraliteNode.attributes, node.attribs)
    assert.deepEqual(coraliteNode.childNodes, [])
    assert.equal(coraliteNode.parentNode, null)
    assert.equal(coraliteNode.previousSibling, null)
    assert.equal(coraliteNode.nextSibling, null)
    assert.equal(coraliteNode.nodeValue, null)
  })

  it('should handle setters', () => {
    const node = {
      type: 'tag',
      name: 'div',
      attribs: { id: 'old' },
      children: [],
      parent: null
    }

    const coraliteNode = createCoraliteElement(node)

    coraliteNode.tagName = 'SPAN'
    assert.equal(coraliteNode.name, 'span')
    assert.equal(coraliteNode.tagName, 'SPAN')

    coraliteNode.id = 'new'
    assert.equal(coraliteNode.attribs.id, 'new')

    coraliteNode.className = 'my-class'
    assert.equal(coraliteNode.attribs.class, 'my-class')
  })

  it('should handle textContent for elements', () => {
    const text = createCoraliteTextNode({
      type: 'text',
      data: 'hello'
    })
    const element = createCoraliteElement({
      type: 'tag',
      name: 'div',
      attribs: {},
      children: [text]
    })
    text.parent = element

    assert.equal(element.textContent, 'hello')

    element.textContent = 'world'
    assert.equal(element.children.length, 1)
    assert.equal(element.children[0].type, 'text')
    assert.equal(element.children[0].data, 'world')
    assert.equal(element.children[0].parent, element)
    assert.equal(element.children[0].nodeType, 3)

    // Test detachment
    const oldText = text
    assert.equal(oldText.parent, null)
  })

  it('should support attribute methods', () => {
    const element = createCoraliteElement({
      type: 'tag',
      name: 'div'
    })

    element.setAttribute('data-test', 'value')
    assert.equal(element.getAttribute('data-test'), 'value')
    assert.equal(element.hasAttribute('data-test'), true)

    element.removeAttribute('data-test')
    assert.equal(element.getAttribute('data-test'), null)
    assert.equal(element.hasAttribute('data-test'), false)
  })

  it('should support appendChild and maintain AST integrity', () => {
    const parent = createCoraliteElement({
      type: 'tag',
      name: 'div'
    })
    const child1 = createCoraliteElement({
      type: 'tag',
      name: 'span'
    })
    const child2 = createCoraliteTextNode({
      type: 'text',
      data: 'hello'
    })

    parent.appendChild(child1)
    assert.equal(parent.children.length, 1)
    assert.equal(child1.parent, parent)
    assert.equal(child1.prev, null)
    assert.equal(child1.next, null)

    parent.appendChild(child2)
    assert.equal(parent.children.length, 2)
    assert.equal(child2.parent, parent)
    assert.equal(child2.prev, child1)
    assert.equal(child1.next, child2)
    assert.equal(child2.next, null)

    // Test moving a node
    const otherParent = createCoraliteElement({
      type: 'tag',
      name: 'section'
    })
    otherParent.appendChild(child1)
    assert.equal(parent.children.length, 1)
    assert.equal(parent.children[0], child2)
    assert.equal(child2.prev, null)
    assert.equal(child1.parent, otherParent)
    assert.equal(child1.prev, null)
    assert.equal(child1.next, null)
  })

  it('should support append with strings and nodes', () => {
    const parent = createCoraliteElement({
      type: 'tag',
      name: 'div'
    })
    const child1 = createCoraliteElement({
      type: 'tag',
      name: 'span'
    })

    parent.append(child1, ' world')
    assert.equal(parent.children.length, 2)
    assert.equal(parent.children[0], child1)
    assert.equal(parent.children[1].type, 'text')
    assert.equal(parent.children[1].data, ' world')
    assert.equal(parent.children[1].prev, child1)
    assert.equal(child1.next, parent.children[1])
  })

  it('should support remove and maintain AST integrity', () => {
    const parent = createCoraliteElement({
      type: 'tag',
      name: 'div'
    })
    const child1 = createCoraliteElement({
      type: 'tag',
      name: 'span'
    })
    const child2 = createCoraliteElement({
      type: 'tag',
      name: 'p'
    })
    const child3 = createCoraliteElement({
      type: 'tag',
      name: 'b'
    })

    parent.appendChild(child1)
    parent.appendChild(child2)
    parent.appendChild(child3)

    child2.remove()
    assert.equal(parent.children.length, 2)
    assert.equal(parent.children[0], child1)
    assert.equal(parent.children[1], child3)
    assert.equal(child1.next, child3)
    assert.equal(child3.prev, child1)
    assert.equal(child2.parent, null)
    assert.equal(child2.prev, null)
    assert.equal(child2.next, null)
  })

  it('should support classList with memoization', () => {
    const element = createCoraliteElement({
      type: 'tag',
      name: 'div',
      attribs: {
        class: 'a b'
      }
    })
    const cl = element.classList
    assert.strictEqual(cl, element.classList)

    assert.equal(cl.contains('a'), true)
    assert.equal(cl.contains('c'), false)

    cl.add('c')
    assert.equal(element.className, 'a b c')
    assert.equal(cl.contains('c'), true)

    cl.remove('b')
    assert.equal(element.className, 'a c')

    cl.toggle('d')
    assert.equal(element.className, 'a c d')
    cl.toggle('d')
    assert.equal(element.className, 'a c')
  })

  it('should handle parentElement setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const parent = createCoraliteElement({ name: 'span' })
    el.parentElement = parent
    assert.equal(el.parent, parent)
    assert.equal(el.parentElement, parent)
  })

  it('should treat nodeValue as a no-op for elements', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.equal(el.nodeValue, null)
    el.nodeValue = 'test'
    assert.equal(el.nodeValue, null)
  })

  it('should handle attributes setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const attribs = { id: 'test' }
    el.attributes = attribs
    assert.equal(el.attribs, attribs)
  })

  it('should handle childNodes getter/setter', () => {
    const el = createCoraliteElement({ name: 'div' })
    const children = [createCoraliteTextNode({ data: 'hi' })]
    el.childNodes = children
    assert.equal(el.children, children)
    assert.deepEqual(el.childNodes, children)
  })

  it('should handle firstChild and lastChild', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.equal(el.firstChild, null)
    assert.equal(el.lastChild, null)

    const child1 = createCoraliteTextNode({ data: '1' })
    const child2 = createCoraliteTextNode({ data: '2' })
    el.appendChild(child1)
    el.appendChild(child2)

    assert.equal(el.firstChild, child1)
    assert.equal(el.lastChild, child2)
  })

  it('should handle textContent with no children', () => {
    const el = createCoraliteElement({ name: 'div' })
    el.children = null
    assert.equal(el.textContent, '')
  })

  it('should default id and className to empty strings', () => {
    const el = createCoraliteElement({ name: 'div' })
    assert.equal(el.id, '')
    assert.equal(el.className, '')
  })

  it('should support classList toggle with force argument', () => {
    const el = createCoraliteElement({ name: 'div' })
    el.classList.toggle('a', true)
    assert.equal(el.className, 'a')
    el.classList.toggle('a', true)
    assert.equal(el.className, 'a')
    el.classList.toggle('a', false)
    assert.equal(el.className, '')
    el.classList.toggle('a', false)
    assert.equal(el.className, '')
  })

  it('should expose classList.value', () => {
    const el = createCoraliteElement({
      name: 'div',
      attribs: { class: 'a b' }
    })
    assert.equal(el.classList.value, 'a b')
  })
})

describe('createCoraliteTextNode', () => {
  it('should enhance a text node', () => {
    const node = {
      type: 'text',
      data: 'hello',
      parent: null
    }

    const coraliteNode = createCoraliteTextNode(node)

    assert.equal(coraliteNode.tagName, undefined)
    assert.equal(coraliteNode.nodeName, '#text')
    assert.equal(coraliteNode.nodeType, 3)
    assert.equal(coraliteNode.nodeValue, 'hello')
    assert.equal(coraliteNode.textContent, 'hello')
    assert.equal(coraliteNode.attributes, undefined)
  })

  it('should support nodeValue and textContent setters', () => {
    const text = createCoraliteTextNode({ data: 'old' })
    text.nodeValue = 'new1'
    assert.equal(text.data, 'new1')
    text.textContent = 'new2'
    assert.equal(text.data, 'new2')
  })
})

describe('createCoraliteComment', () => {
  it('should enhance a comment node', () => {
    const node = {
      type: 'comment',
      data: 'my comment',
      parent: null
    }

    const coraliteNode = createCoraliteComment(node)

    assert.equal(coraliteNode.tagName, undefined)
    assert.equal(coraliteNode.nodeName, '#comment')
    assert.equal(coraliteNode.nodeType, 8)
    assert.equal(coraliteNode.nodeValue, 'my comment')
    assert.equal(coraliteNode.textContent, 'my comment')
  })

  it('should support nodeValue and textContent setters', () => {
    const comment = createCoraliteComment({ data: 'old' })
    comment.nodeValue = 'new1'
    assert.equal(comment.data, 'new1')
    comment.textContent = 'new2'
    assert.equal(comment.data, 'new2')
  })
})

describe('createCoraliteComponent', () => {
  it('should enhance a component root', () => {
    const node = {
      type: 'root',
      children: []
    }

    const coraliteNode = createCoraliteComponent(node)

    assert.equal(coraliteNode.nodeName, '#document')
    assert.equal(coraliteNode.nodeType, 9)
    assert.equal(coraliteNode.nodeValue, null)
    assert.deepEqual(coraliteNode.childNodes, [])
  })

  it('should support childNodes, firstChild, lastChild and textContent', () => {
    const root = createCoraliteComponent({ children: [] })
    assert.equal(root.firstChild, null)
    assert.equal(root.lastChild, null)
    assert.equal(root.textContent, null)

    const child = createCoraliteElement({ name: 'html' })
    root.childNodes = [child]
    assert.equal(root.firstChild, child)
    assert.equal(root.lastChild, child)
  })
})

describe('Sibling Traversal (Common)', () => {
  it('should traverse siblings correctly', () => {
    const parent = createCoraliteElement({
      type: 'tag',
      name: 'div'
    })
    const child1 = createCoraliteElement({
      type: 'tag',
      name: 'div',
      attribs: {},
      children: []
    })
    const child2 = createCoraliteTextNode({
      type: 'text',
      data: 'text'
    })
    const child3 = createCoraliteComment({
      type: 'comment',
      data: 'comment'
    })

    parent.appendChild(child1)
    parent.appendChild(child2)
    parent.appendChild(child3)

    assert.equal(child1.nextSibling, child2)
    assert.equal(child1.previousSibling, null)

    assert.equal(child2.nextSibling, child3)
    assert.equal(child2.previousSibling, child1)

    assert.equal(child3.nextSibling, null)
    assert.equal(child3.previousSibling, child2)
  })
})

describe('createCoraliteDirective', () => {
  it('should enhance a directive node', () => {
    const directive = createCoraliteDirective({
      name: '!DOCTYPE',
      data: 'html'
    })
    assert.equal(directive.nodeName, '!DOCTYPE')
    assert.equal(directive.nodeValue, 'html')
    directive.nodeValue = 'HTML'
    assert.equal(directive.data, 'HTML')
  })
})

describe('relinkChildren and enhanceNode', () => {
  it('should relink plain AST children', () => {
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
    assert.equal(parent.children[0].parent, parent)
    assert.equal(parent.children[0].next, parent.children[1])

    assert.ok(parent.children[1].children[0].__coralite_enhanced__)
    assert.equal(parent.children[1].children[0].parent, parent.children[1])
  })

  it('should skip enhancing already enhanced nodes', () => {
    const node = createCoraliteElement({ name: 'div' })
    const protoBefore = Object.getPrototypeOf(node)
    enhanceNode(node)
    assert.equal(Object.getPrototypeOf(node), protoBefore)
  })

  it('should apply default prototype for unknown types', () => {
    const node = enhanceNode({ type: 'unknown' })
    assert.equal(node.nodeType, 1)
  })
})
