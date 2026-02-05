import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  createCoraliteElement,
  createCoraliteTextNode,
  createCoraliteComment,
  createCoraliteDocument
} from '../../../lib/dom.js'

describe('createCoraliteElement', () => {
  it('should enhance an element node with DOM properties', () => {
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

describe('createCoraliteDocument', () => {
  it('should enhance a document root', () => {
    const node = {
      type: 'root',
      children: []
    }

    const coraliteNode = createCoraliteDocument(node)

    assert.equal(coraliteNode.nodeName, '#document')
    assert.equal(coraliteNode.nodeType, 9)
    assert.equal(coraliteNode.nodeValue, null)
    assert.deepEqual(coraliteNode.childNodes, [])
  })
})

describe('Sibling Traversal (Common)', () => {
  it('should traverse siblings correctly', () => {
    const parent = { children: [] }
    const child1 = createCoraliteElement({
      type: 'tag',
      name: 'div',
      parent,
      attribs: {},
      children: []
    })
    const child2 = createCoraliteTextNode({
      type: 'text',
      data: 'text',
      parent
    })
    const child3 = createCoraliteComment({
      type: 'comment',
      data: 'comment',
      parent
    })

    parent.children = [child1, child2, child3]

    assert.equal(child1.nextSibling, child2)
    assert.equal(child1.previousSibling, null)

    assert.equal(child2.nextSibling, child3)
    assert.equal(child2.previousSibling, child1)

    assert.equal(child3.nextSibling, null)
    assert.equal(child3.previousSibling, child2)
  })
})
