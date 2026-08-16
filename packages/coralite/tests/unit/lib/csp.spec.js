import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  calculateHash,
  resolveNonce,
  formatCSPDirectives,
  injectCSPMeta
} from '../../../lib/utils/server/csp.js'
import { defineConfig } from '../../../lib/config.js'
import { CoraliteError } from '../../../lib/utils/errors.js'
import { createCoraliteElement } from '../../../lib/utils/server/dom.js'

describe('CSP Utilities & Config Validation', () => {
  describe('calculateHash', () => {
    it('calculates valid sha256, sha384, and sha512 hashes', () => {
      const code = 'console.log("hello world");'
      const h256 = calculateHash(code, 'sha256')
      const h384 = calculateHash(code, 'sha384')
      const h512 = calculateHash(code, 'sha512')

      assert.match(h256, /^'sha256-[A-Za-z0-9+/=]+'$/)
      assert.match(h384, /^'sha384-[A-Za-z0-9+/=]+'$/)
      assert.match(h512, /^'sha512-[A-Za-z0-9+/=]+'$/)
    })

    it('returns empty string for non-string content', () => {
      assert.strictEqual(calculateHash(null), '')
      assert.strictEqual(calculateHash(undefined), '')
      assert.strictEqual(calculateHash(123), '')
    })

    it('throws CoraliteError for invalid hash algorithm', () => {
      assert.throws(() => calculateHash('code', 'md5'), CoraliteError)
      assert.throws(() => calculateHash('code', 'sha1'), /Invalid CSP hash algorithm/)
    })
  })

  describe('resolveNonce', () => {
    it('resolves nonce from buildOptions, pageContext meta, session, or config', () => {
      assert.strictEqual(resolveNonce({ buildOptions: { nonce: 'nonce-1' } }), 'nonce-1')
      assert.strictEqual(resolveNonce({ pageContext: { meta: { nonce: 'nonce-2' } } }), 'nonce-2')
      assert.strictEqual(resolveNonce({ session: { nonce: 'nonce-3' } }), 'nonce-3')
      assert.strictEqual(resolveNonce({ config: { csp: { nonce: 'nonce-4' } } }), 'nonce-4')
    })

    it('supports function nonce providers', () => {
      const fn = (ctx) => `dynamic-${ctx.session?.id}`
      assert.strictEqual(resolveNonce({ session: { id: 's1' }, config: { csp: { nonce: fn } } }), 'dynamic-s1')
    })

    it('returns null if no nonce is resolved', () => {
      assert.strictEqual(resolveNonce({}), null)
      assert.strictEqual(resolveNonce({ buildOptions: { nonce: '   ' } }), null)
    })
  })

  describe('formatCSPDirectives', () => {
    it('formats nonce directives with script-src strict-dynamic and nonce', () => {
      const header = formatCSPDirectives(
        { 'default-src': ["'self'"] },
        { nonce: 'secret123' }
      )
      assert.ok(header.includes("script-src 'self' 'strict-dynamic' 'nonce-secret123'"))
      assert.ok(header.includes("style-src 'self' 'nonce-secret123'"))
      assert.ok(header.includes("default-src 'self'"))
    })

    it('formats hash directives with script-src strict-dynamic and hashes', () => {
      const header = formatCSPDirectives(
        {},
        {
          scriptHashes: ["'sha256-script1'"],
          styleHashes: ["'sha256-style1'"]
        }
      )
      assert.ok(header.includes("script-src 'self' 'strict-dynamic' 'sha256-script1'"))
      assert.ok(header.includes("style-src 'self' 'sha256-style1'"))
    })

    it('preserves existing custom directives', () => {
      const header = formatCSPDirectives(
        { 'connect-src': ["'self'", 'https://api.example.com'] },
        { nonce: 'test' }
      )
      assert.ok(header.includes("connect-src 'self' https://api.example.com"))
    })
  })

  describe('injectCSPMeta', () => {
    it('injects meta tag into head if present or root', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', children: [] })
      const head = createCoraliteElement({ type: 'tag', name: 'head', parent: root, children: [] })
      root.children.push(head)

      injectCSPMeta(root, head, "default-src 'self'")
      assert.strictEqual(head.children[0].name, 'meta')
      assert.strictEqual(head.children[0].attribs['http-equiv'], 'Content-Security-Policy')
      assert.strictEqual(head.children[0].attribs.content, "default-src 'self'")
    })

    it('supports reportOnly meta tag injection', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', children: [] })

      injectCSPMeta(root, null, "default-src 'self'", true)
      assert.strictEqual(root.children[0].attribs['http-equiv'], 'Content-Security-Policy-Report-Only')
    })
  })

  describe('defineConfig validation', () => {
    const baseConfig = {
      output: '.coralite',
      components: 'src/components',
      pages: 'src/pages'
    }

    it('validates valid csp config object', () => {
      assert.doesNotThrow(() => defineConfig({
        ...baseConfig,
        csp: {
          enabled: true,
          nonce: 'secret',
          hashAlgorithm: 'sha256',
          injectMeta: true,
          reportOnly: false,
          externalScripts: false,
          externalStyles: false,
          directives: { 'default-src': ["'self'"] }
        }
      }))
    })

    it('throws on invalid csp properties', () => {
      assert.throws(() => defineConfig({ ...baseConfig, csp: 'invalid' }), CoraliteError)
      assert.throws(() => defineConfig({ ...baseConfig, csp: { enabled: 'true' } }), /must be a boolean/)
      assert.throws(() => defineConfig({ ...baseConfig, csp: { hashAlgorithm: 'sha1' } }), /Invalid csp.hashAlgorithm/)
    })
  })
})
