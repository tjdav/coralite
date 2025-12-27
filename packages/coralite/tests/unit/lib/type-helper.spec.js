/**
 * Tests for type-helper.js
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment,
  isCoraliteDirective,
  isCoraliteDocumentRoot,
  isCoraliteSlotElement,
  isCoraliteCollectionItem,
  isCoraliteNode,
  hasValidElementStructure,
  hasValidTextNodeStructure,
  hasValidCommentStructure,
  isValidChildNode,
  isParentNode,
  isRemovableNode
} from '../../../lib/type-helper.js'

describe('type-helper.js', () => {
  describe('Core Type Guards', () => {
    describe('isCoraliteElement', () => {
      it('should return true for valid CoraliteElement', () => {
        const element = {
          type: 'tag',
          name: 'div',
          attribs: {},
          children: []
        }
        assert.strictEqual(isCoraliteElement(element), true)
      })

      it('should return false for non-objects', () => {
        assert.strictEqual(isCoraliteElement(null), false)
        assert.strictEqual(isCoraliteElement(undefined), false)
        assert.strictEqual(isCoraliteElement('string'), false)
        assert.strictEqual(isCoraliteElement(123), false)
      })

      it('should return false for objects without tag type', () => {
        assert.strictEqual(isCoraliteElement({
          type: 'text',
          data: 'hello'
        }), false)
        assert.strictEqual(isCoraliteElement({
          type: 'comment',
          data: 'comment'
        }), false)
        assert.strictEqual(isCoraliteElement({
          type: 'directive',
          data: 'doctype'
        }), false)
        assert.strictEqual(isCoraliteElement({
          type: 'root',
          children: []
        }), false)
      })

      it('should return false for objects with wrong type property', () => {
        assert.strictEqual(isCoraliteElement({
          type: 'wrong',
          name: 'div'
        }), false)
      })
    })

    describe('isCoraliteTextNode', () => {
      it('should return true for valid CoraliteTextNode', () => {
        const textNode = {
          type: 'text',
          data: 'hello world'
        }
        assert.strictEqual(isCoraliteTextNode(textNode), true)
      })

      it('should return false for non-text types', () => {
        assert.strictEqual(isCoraliteTextNode({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(isCoraliteTextNode({
          type: 'comment',
          data: 'comment'
        }), false)
      })
    })

    describe('isCoraliteComment', () => {
      it('should return true for valid CoraliteComment', () => {
        const comment = {
          type: 'comment',
          data: 'This is a comment'
        }
        assert.strictEqual(isCoraliteComment(comment), true)
      })

      it('should return false for non-comment types', () => {
        assert.strictEqual(isCoraliteComment({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(isCoraliteComment({
          type: 'text',
          data: 'text'
        }), false)
      })
    })

    describe('isCoraliteDirective', () => {
      it('should return true for valid CoraliteDirective', () => {
        const directive = {
          type: 'directive',
          data: '<!DOCTYPE html>',
          name: 'DOCTYPE'
        }
        assert.strictEqual(isCoraliteDirective(directive), true)
      })

      it('should return false for non-directive types', () => {
        assert.strictEqual(isCoraliteDirective({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(isCoraliteDirective({
          type: 'text',
          data: 'text'
        }), false)
      })
    })

    describe('isCoraliteDocumentRoot', () => {
      it('should return true for valid CoraliteDocumentRoot', () => {
        const root = {
          type: 'root',
          children: []
        }
        assert.strictEqual(isCoraliteDocumentRoot(root), true)
      })

      it('should return false for non-root types', () => {
        assert.strictEqual(isCoraliteDocumentRoot({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(isCoraliteDocumentRoot({
          type: 'text',
          data: 'text'
        }), false)
      })
    })

    describe('isCoraliteSlotElement', () => {
      it('should return true for valid CoraliteSlotElement', () => {
        const slotElement = {
          name: 'content',
          element: {
            type: 'tag',
            name: 'div',
            attribs: {},
            children: []
          }
        }
        assert.strictEqual(isCoraliteSlotElement(slotElement), true)
      })

      it('should return true for slot element with customElement', () => {
        const slotElement = {
          name: 'content',
          element: {
            type: 'tag',
            name: 'div',
            attribs: {},
            children: []
          },
          customElement: {
            type: 'tag',
            name: 'custom-div',
            attribs: {},
            children: []
          }
        }
        assert.strictEqual(isCoraliteSlotElement(slotElement), true)
      })

      it('should return false for invalid slot elements', () => {
        assert.strictEqual(isCoraliteSlotElement({
          name: 'content'
        }), false)
        assert.strictEqual(isCoraliteSlotElement({
          element: {
            type: 'tag',
            name: 'div'
          }
        }), false)
        assert.strictEqual(isCoraliteSlotElement({
          name: 123,
          element: {
            type: 'tag',
            name: 'div'
          }
        }), false)
      })
    })

    describe('isCoraliteCollectionItem', () => {
      it('should return true for valid CoraliteCollectionItem', () => {
        const item = {
          path: {
            pathname: '/test',
            dirname: '/test',
            filename: 'index.html'
          },
          content: '<div>test</div>'
        }
        assert.strictEqual(isCoraliteCollectionItem(item), true)
      })

      it('should return false for missing required properties', () => {
        assert.strictEqual(isCoraliteCollectionItem({
          content: '<div>test</div>'
        }), false)
        assert.strictEqual(isCoraliteCollectionItem({
          path: {}
        }), false)
        assert.strictEqual(isCoraliteCollectionItem({
          path: {},
          content: 123
        }), false)
      })

      it('should return false for invalid path structure', () => {
        assert.strictEqual(isCoraliteCollectionItem({
          path: 'string',
          content: '<div>test</div>'
        }), false)
      })
    })
  })

  describe('Utility Type Guards', () => {
    describe('isCoraliteNode', () => {
      it('should return true for all node types', () => {
        assert.strictEqual(isCoraliteNode({
          type: 'tag',
          name: 'div',
          attribs: {},
          children: []
        }), true)
        assert.strictEqual(isCoraliteNode({
          type: 'text',
          data: 'text'
        }), true)
        assert.strictEqual(isCoraliteNode({
          type: 'comment',
          data: 'comment'
        }), true)
        assert.strictEqual(isCoraliteNode({
          type: 'directive',
          data: 'doctype',
          name: 'DOCTYPE'
        }), true)
        assert.strictEqual(isCoraliteNode({
          type: 'root',
          children: []
        }), true)
      })

      it('should return false for non-node types', () => {
        assert.strictEqual(isCoraliteNode({
          type: 'unknown'
        }), false)
        assert.strictEqual(isCoraliteNode({}), false)
        assert.strictEqual(isCoraliteNode(null), false)
        assert.strictEqual(isCoraliteNode('string'), false)
      })
    })
  })

  describe('Structure Validation', () => {
    describe('hasValidElementStructure', () => {
      it('should return true for properly structured element', () => {
        const element = {
          type: 'tag',
          name: 'div',
          attribs: {
            class: 'container'
          },
          children: []
        }
        assert.strictEqual(hasValidElementStructure(element), true)
      })

      it('should return false for incomplete structure', () => {
        assert.strictEqual(hasValidElementStructure({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(hasValidElementStructure({
          type: 'tag',
          name: 'div',
          attribs: {}
        }), false)
        assert.strictEqual(hasValidElementStructure({
          type: 'tag',
          name: 'div',
          children: []
        }), false)
      })
    })

    describe('hasValidTextNodeStructure', () => {
      it('should return true for properly structured text node', () => {
        const textNode = {
          type: 'text',
          data: 'hello world'
        }
        assert.strictEqual(hasValidTextNodeStructure(textNode), true)
      })

      it('should return false for missing data property', () => {
        assert.strictEqual(hasValidTextNodeStructure({
          type: 'text'
        }), false)
      })
    })

    describe('hasValidCommentStructure', () => {
      it('should return true for properly structured comment', () => {
        const comment = {
          type: 'comment',
          data: 'This is a comment'
        }
        assert.strictEqual(hasValidCommentStructure(comment), true)
      })

      it('should return false for missing data property', () => {
        assert.strictEqual(hasValidCommentStructure({
          type: 'comment'
        }), false)
      })
    })
  })

  describe('Node Property Checks', () => {
    describe('isValidChildNode', () => {
      it('should return true for valid child node types', () => {
        assert.strictEqual(isValidChildNode({
          type: 'tag',
          name: 'div',
          attribs: {},
          children: []
        }), true)
        assert.strictEqual(isValidChildNode({
          type: 'text',
          data: 'text'
        }), true)
        assert.strictEqual(isValidChildNode({
          type: 'comment',
          data: 'comment'
        }), true)
        assert.strictEqual(isValidChildNode({
          type: 'directive',
          data: 'doctype',
          name: 'DOCTYPE'
        }), true)
      })

      it('should return false for invalid child node types', () => {
        assert.strictEqual(isValidChildNode({
          type: 'root',
          children: []
        }), false)
        assert.strictEqual(isValidChildNode({
          type: 'unknown'
        }), false)
        assert.strictEqual(isValidChildNode(null), false)
      })
    })

    describe('isParentNode', () => {
      it('should return true for nodes with children array', () => {
        const parent = {
          children: [{
            type: 'text',
            data: 'text'
          }]
        }
        assert.strictEqual(isParentNode(parent), true)
      })

      it('should return false for nodes without children', () => {
        assert.strictEqual(isParentNode({
          type: 'text',
          data: 'text'
        }), false)
        assert.strictEqual(isParentNode({}), false)
        assert.strictEqual(isParentNode(null), false)
      })
    })

    describe('isRemovableNode', () => {
      it('should return true for nodes with remove=true', () => {
        const node = {
          type: 'tag',
          name: 'div',
          remove: true
        }
        assert.strictEqual(isRemovableNode(node), true)
      })

      it('should return false for nodes without remove property or remove=false', () => {
        assert.strictEqual(isRemovableNode({
          type: 'tag',
          name: 'div'
        }), false)
        assert.strictEqual(isRemovableNode({
          type: 'tag',
          name: 'div',
          remove: false
        }), false)
        assert.strictEqual(isRemovableNode({
          type: 'tag',
          name: 'div',
          remove: 'true'
        }), false)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      assert.strictEqual(isCoraliteElement(null), false)
      assert.strictEqual(isCoraliteElement(undefined), false)
      assert.strictEqual(isCoraliteTextNode(null), false)
      assert.strictEqual(isCoraliteComment(undefined), false)
      assert.strictEqual(isCoraliteDirective(null), false)
      assert.strictEqual(isCoraliteDocumentRoot(undefined), false)
      assert.strictEqual(isCoraliteSlotElement(null), false)
      assert.strictEqual(isCoraliteCollectionItem(undefined), false)
      assert.strictEqual(isCoraliteNode(null), false)
      assert.strictEqual(hasValidElementStructure(undefined), false)
      assert.strictEqual(hasValidTextNodeStructure(null), false)
      assert.strictEqual(hasValidCommentStructure(undefined), false)
      assert.strictEqual(isValidChildNode(null), false)
      assert.strictEqual(isParentNode(undefined), false)
      assert.strictEqual(isRemovableNode(null), false)
    })

    it('should handle objects with extra properties', () => {
      const element = {
        type: 'tag',
        name: 'div',
        attribs: {},
        children: [],
        extraProp: 'should not affect check'
      }
      assert.strictEqual(isCoraliteElement(element), true)
      assert.strictEqual(hasValidElementStructure(element), true)
    })

    it('should handle objects with missing optional properties', () => {
      const slotElement = {
        name: 'content',
        element: {
          type: 'tag',
          name: 'div',
          attribs: {},
          children: []
        }
        // customElement is optional
      }
      assert.strictEqual(isCoraliteSlotElement(slotElement), true)
    })
  })
})
