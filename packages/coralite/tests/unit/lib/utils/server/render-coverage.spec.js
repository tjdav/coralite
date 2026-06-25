import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  findHeadAndBody,
  injectExternalStyles,
  injectStyles,
  injectReadinessScript,
  injectImportMap,
  removeElements,
  resolvePageQueue
} from '../../../../../lib/utils/server/render.js'
import { createCoraliteElement, createCoraliteComponent } from '../../../../../lib/utils/server/dom.js'

describe('render.js Coverage Gaps', () => {
  describe('findHeadAndBody', () => {
    it('should find head and body in html tag', () => {
      const head = createCoraliteElement({ name: 'head' })
      const body = createCoraliteElement({ name: 'body' })
      const html = createCoraliteElement({
        name: 'html',
        children: [head, body]
      })
      const root = createCoraliteComponent({ children: [html] })

      const result = findHeadAndBody(root)
      assert.strictEqual(result.head, head)
      assert.strictEqual(result.body, body)
    })

    it('should return null head and root body if not found', () => {
      const root = createCoraliteComponent({ children: [] })
      const result = findHeadAndBody(root)
      assert.strictEqual(result.head, null)
      assert.strictEqual(result.body, root)
    })
  })

  describe('injectExternalStyles', () => {
    it('should inject links into head', () => {
      const head = createCoraliteElement({
        name: 'head',
        children: []
      })
      const root = createCoraliteComponent({ children: [head] })
      injectExternalStyles(root, head, ['style.css'])
      assert.strictEqual(head.children.length, 1)
      assert.strictEqual(head.children[0].attribs.href, 'style.css')
    })

    it('should inject links into root if head is null', () => {
      const root = createCoraliteComponent({ children: [] })
      injectExternalStyles(root, null, ['style.css'])
      assert.strictEqual(root.children.length, 1)
      assert.strictEqual(root.children[0].name, 'link')
    })

    it('should skip duplicate links', () => {
      const link = createCoraliteElement({
        name: 'link',
        attribs: {
          rel: 'stylesheet',
          href: 'style.css'
        }
      })
      const head = createCoraliteElement({
        name: 'head',
        children: [link]
      })
      const root = createCoraliteComponent({ children: [head] })
      injectExternalStyles(root, head, ['style.css'])
      assert.strictEqual(head.children.length, 1)
    })
  })

  describe('injectStyles', () => {
    it('should inject style tag into head', () => {
      const head = createCoraliteElement({
        name: 'head',
        children: []
      })
      const root = createCoraliteComponent({ children: [head] })
      const styles = new Map([['sel', 'color: red']])
      injectStyles(root, head, styles)
      assert.strictEqual(head.children.length, 1)
      assert.strictEqual(head.children[0].name, 'style')
      assert.ok(head.children[0].children[0].data.includes('color: red'))
    })
  })

  describe('injectReadinessScript', () => {
    it('should inject into root', () => {
      const root = createCoraliteComponent({ children: [] })
      injectReadinessScript(root, null, true)
      assert.strictEqual(root.children[0].name, 'script')
      assert.ok(root.children[0].children[0].data.includes('window.__coralite__'))
      assert.ok(root.children[0].children[0].data.includes('lifecycle:'))
    })
  })

  describe('injectImportMap', () => {
    it('should inject into head', () => {
      const head = createCoraliteElement({
        name: 'head',
        children: []
      })
      const root = createCoraliteComponent({ children: [head] })
      injectImportMap(root, head, { pkg: '/pkg.js' })
      assert.strictEqual(head.children.length, 1)
      assert.strictEqual(head.children[0].attribs.type, 'importmap')
    })
  })

  describe('removeElements', () => {
    it('should remove by identity', () => {
      const el = createCoraliteElement({ name: 'div' })
      const parent = createCoraliteElement({
        name: 'span',
        children: [el]
      })
      el.parent = parent
      removeElements([el], true)
      assert.strictEqual(parent.children.length, 0)
    })

    it('should remove by markedForRemoval', () => {
      const el = createCoraliteElement({ name: 'div' })
      // @ts-ignore
      el._markedForRemoval = true
      const parent = createCoraliteElement({
        name: 'span',
        children: [el]
      })
      el.parent = parent
      removeElements([el], false)
      assert.strictEqual(parent.children.length, 0)
    })
  })

  describe('resolvePageQueue', () => {
    it('should handle array of paths', () => {
      const mockCollection = {
        getListByPath: (p) => (p === 'dir' ? [{ id: '1' }] : null),
        getItem: (p) => (p === 'file' ? { id: '2' } : null)
      }
      // @ts-ignore
      const queue = resolvePageQueue(mockCollection, ['dir', 'file'])
      assert.strictEqual(queue.length, 2)
    })
  })
})
