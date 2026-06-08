import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  createCoraliteElement,
  createCoraliteTextNode,
  createCoraliteComment,
  createCoraliteComponent
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
