/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createImportCSS } from '../../../../lib/client/utils/stylesheets.js'

class FakeLink extends EventTarget {
  constructor () {
    super()
    this.attributes = {}
    this.parentNode = null
    this.sheet = null
    this.nonce = ''
  }

  setAttribute (name, value) {
    this.attributes[name] = String(value)
  }

  getAttribute (name) {
    return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null
  }

  dispatchLoad () {
    this.sheet = { cssRules: [] }
    this.dispatchEvent(new Event('load'))
  }

  dispatchError () {
    this.dispatchEvent(new Event('error'))
  }
}

function createDocumentMock () {
  const head = {
    children: [],
    appendChild (link) {
      link.parentNode = head
      head.children.push(link)
      return link
    },
    insertBefore (link, reference) {
      const index = head.children.indexOf(reference)
      link.parentNode = head
      head.children.splice(index === -1 ? head.children.length : index, 0, link)
      return link
    },
    removeChild (link) {
      const index = head.children.indexOf(link)
      if (index !== -1) {
        head.children.splice(index, 1)
      }
      link.parentNode = null
      return link
    },
    querySelectorAll (selector) {
      if (selector === 'link[data-coralite-stylesheet]') {
        return head.children.filter(child => child.getAttribute('data-coralite-stylesheet') !== null)
      }
      return head.children.slice()
    }
  }

  return {
    head,
    createElement (tag) {
      assert.equal(tag, 'link')
      return new FakeLink()
    },
    querySelectorAll (selector) {
      return head.querySelectorAll(selector)
    }
  }
}

describe('createImportCSS', () => {
  let originalWindow
  let originalDocument
  let documentMock

  beforeEach(() => {
    originalWindow = globalThis.window
    originalDocument = globalThis.document
    documentMock = createDocumentMock()
    globalThis.document = documentMock
    globalThis.window = {
      __coralite_styles_loaded__: new Set()
    }
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  })

  const createHelper = (manifest = {}) => createImportCSS({
    base: '/app/',
    manifest
  })

  it('injects a bundled stylesheet handle, applies attributes, and resolves to { default: link.sheet, link }', async () => {
    const importCSS = createHelper({
      stylesheets: {
        'acme-123456': {
          href: 'assets/css/acme-abc123.css',
          media: 'print',
          nonce: 'nonce-1',
          crossorigin: 'anonymous',
          referrerPolicy: 'no-referrer',
          order: 0
        }
      }
    })

    const promise = importCSS('acme-123456')
    const link = documentMock.head.children[0]

    assert.ok(link, 'link should be injected immediately')
    assert.equal(link.getAttribute('href'), '/app/assets/css/acme-abc123.css')
    assert.equal(link.getAttribute('media'), 'print')
    assert.equal(link.getAttribute('nonce'), 'nonce-1')
    assert.equal(link.getAttribute('crossorigin'), 'anonymous')
    assert.equal(link.getAttribute('referrerpolicy'), 'no-referrer')

    link.dispatchLoad()
    const result = await promise

    assert.equal(result.link, link)
    assert.equal(result.default, link.sheet)
    assert.ok(window.__coralite_styles_loaded__.has('/app/assets/css/acme-abc123.css'))
  })

  it('supports both flat options and standard Import Attributes { with: { ... } }', async () => {
    const importCSS = createHelper({
      stylesheets: {
        'acme-123456': {
          href: 'assets/css/acme-abc123.css',
          order: 0
        }
      }
    })

    const promise = importCSS('acme-123456', {
      with: {
        type: 'css',
        media: 'screen',
        crossorigin: 'use-credentials',
        referrerpolicy: 'origin',
        nonce: 'nonce-with'
      }
    })
    const link = documentMock.head.children[0]

    assert.equal(link.getAttribute('media'), 'screen')
    assert.equal(link.getAttribute('crossorigin'), 'use-credentials')
    assert.equal(link.getAttribute('referrerpolicy'), 'origin')
    assert.equal(link.getAttribute('nonce'), 'nonce-with')

    link.dispatchLoad()
    const result = await promise
    assert.equal(result.link, link)
  })

  it('resolves existing loaded links without injecting a duplicate', async () => {
    const importCSS = createHelper()
    const existing = new FakeLink()
    existing.sheet = { cssRules: [] }
    existing.setAttribute('rel', 'stylesheet')
    existing.setAttribute('href', '/shared.css')
    documentMock.head.appendChild(existing)

    const result = await importCSS('/shared.css')

    assert.equal(documentMock.head.children.length, 1)
    assert.equal(documentMock.head.children[0], existing)
    assert.equal(result.link, existing)
    assert.equal(result.default, existing.sheet)
  })

  it('rejects on load errors and allows force retries', async () => {
    const importCSS = createHelper({
      stylesheets: {
        acme: { href: 'assets/css/acme.css' }
      }
    })

    const failed = importCSS('acme')
    const failedLink = documentMock.head.children[0]
    failedLink.dispatchError()

    await assert.rejects(failed, /Failed to load stylesheet/)

    const retried = importCSS('acme', { force: true })
    assert.equal(documentMock.head.children.length, 1, 'failed link should be removed before retry')
    const retryLink = documentMock.head.children[0]
    assert.notEqual(retryLink, failedLink)
    retryLink.dispatchLoad()
    const result = await retried
    assert.equal(result.link, retryLink)
  })

  it('aborting only stops the wait and leaves the shared link in place', async () => {
    const importCSS = createHelper({
      stylesheets: {
        acme: { href: 'assets/css/acme.css' }
      }
    })
    const controller = new AbortController()
    const promise = importCSS('acme', { signal: controller.signal })
    const link = documentMock.head.children[0]

    controller.abort()

    await assert.rejects(promise, (error) => error.name === 'AbortError')
    assert.equal(documentMock.head.children.length, 1, 'aborted waiter must not remove the link')

    link.dispatchLoad()
    const resolved = await importCSS('acme')
    assert.equal(resolved.link, link)
    assert.ok(window.__coralite_styles_loaded__.has('/app/assets/css/acme.css'))
  })

  it('deduplicates concurrent callers onto one link and one load', async () => {
    const importCSS = createHelper({
      stylesheets: {
        acme: { href: 'assets/css/acme.css' }
      }
    })

    const first = importCSS('acme')
    const second = importCSS('acme')

    assert.equal(documentMock.head.children.length, 1)
    documentMock.head.children[0].dispatchLoad()
    const [res1, res2] = await Promise.all([first, second])
    assert.equal(res1.link, res2.link)
    assert.equal(res1.default, res2.default)
  })

  it('rejects unknown handles that are not URL-like', async () => {
    const importCSS = createHelper()

    await assert.rejects(
      () => importCSS('missing'),
      /Unknown stylesheet handle "missing"/
    )
  })

  it('inserts lazy stylesheets in manifest order', async () => {
    const importCSS = createHelper({
      stylesheets: {
        second: {
          href: 'assets/css/second.css',
          order: 2
        },
        first: {
          href: 'assets/css/first.css',
          order: 1
        }
      }
    })

    const secondPromise = importCSS('second')
    const firstPromise = importCSS('first')

    const links = documentMock.head.children
    assert.equal(links[0].getAttribute('href'), '/app/assets/css/first.css')
    assert.equal(links[1].getAttribute('href'), '/app/assets/css/second.css')

    links.forEach(link => link.dispatchLoad())
    await Promise.all([firstPromise, secondPromise])
  })
})
