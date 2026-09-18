import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateHash, calculateSRIDigest, resolveNonce, formatCSPDirectives, injectCSPMeta } from '../../../lib/utils/server/csp.js'
import { CoraliteError } from '../../../lib/utils/errors.js'
import { createCoraliteElement } from '../../../lib/utils/server/dom.js'
import { defineConfig } from '../../../lib/config.js'

describe('CSP Utilities & Config Validation', () => {
  describe('calculateHash', () => {
    it('should calculate valid sha256 hash formatted string', () => {
      const content = 'console.log("hello");'
      const hash = calculateHash(content, 'sha256')
      assert.match(hash, /^'sha256-[A-Za-z0-9+/=]+'$/)
    })
  })

  describe('calculateSRIDigest and calculateHash algorithm matrix', () => {
    for (const algo of ['sha256', 'sha384', 'sha512']) {
      it(`should support ${algo} for calculateHash and calculateSRIDigest`, () => {
        assert.match(calculateHash('test content', algo), new RegExp(`^'${algo}-[A-Za-z0-9+/=]+'$`))
        assert.match(calculateSRIDigest('test content', algo), new RegExp(`^${algo}-[A-Za-z0-9+/=]+$`))
      })
    }

    it('should calculate sha384 digest by default for string content', () => {
      assert.match(calculateSRIDigest('console.log("hello world");'), /^sha384-[A-Za-z0-9+/=]+$/)
    })

    it('should calculate digest for Buffer content (calculateSRIDigest only)', () => {
      assert.match(calculateSRIDigest(Buffer.from('body { color: red; }', 'utf8'), 'sha256'), /^sha256-[A-Za-z0-9+/=]+$/)
    })

    it('should throw on unsupported algorithm', () => {
      assert.throws(() => {
        // @ts-ignore
        calculateSRIDigest('content', 'md5')
      }, (err) => err instanceof CoraliteError && err.message.includes('Invalid SRI hash algorithm'))

      assert.throws(() => {
        // @ts-ignore
        calculateHash('test', 'md5')
      }, /Invalid CSP hash algorithm/)
    })

    it('should return empty string for non-string / non-Buffer content', () => {
      assert.equal(calculateSRIDigest(null), '')
      assert.equal(calculateSRIDigest(undefined), '')
      assert.equal(calculateSRIDigest(123), '')
      // @ts-ignore
      assert.equal(calculateHash(null), '')
    })
  })

  describe('resolveNonce', () => {
    it('should resolve nonce from buildOptions, pageContext meta, session, or config', () => {
      assert.equal(resolveNonce({ buildOptions: { nonce: 'b-123' } }), 'b-123')
      assert.equal(resolveNonce({ pageContext: { meta: { nonce: 'p-123' } } }), 'p-123')
      assert.equal(resolveNonce({ session: { nonce: 's-123' } }), 's-123')
      assert.equal(resolveNonce({ config: { csp: { nonce: 'c-123' } } }), 'c-123')
    })

    it('should evaluate function nonces', () => {
      const nonceFn = () => 'fn-nonce'
      assert.equal(resolveNonce({ config: { csp: { nonce: nonceFn } } }), 'fn-nonce')
    })

    it('should return null when no nonce found', () => {
      assert.equal(resolveNonce({}), null)
    })

    it('should respect source precedence when multiple nonces are present', () => {
      assert.equal(resolveNonce({
        buildOptions: { nonce: 'b-123' },
        pageContext: { meta: { nonce: 'p-123' } },
        session: { nonce: 's-123' },
        config: { csp: { nonce: 'c-123' } }
      }), 'b-123')

      assert.equal(resolveNonce({
        pageContext: { meta: { nonce: 'p-123' } },
        session: { nonce: 's-123' },
        config: { csp: { nonce: 'c-123' } }
      }), 'p-123')

      assert.equal(resolveNonce({
        session: { nonce: 's-123' },
        config: { csp: { nonce: 'c-123' } }
      }), 's-123')
    })

    it('should skip throwing nonce functions and continue to the next source', () => {
      assert.equal(resolveNonce({
        buildOptions: {
          nonce: () => {
            throw new Error('boom')
          }
        },
        session: { nonce: 's-123' }
      }), 's-123')
    })

    it('should skip whitespace-only nonces and trim resolved values', () => {
      assert.equal(resolveNonce({ buildOptions: { nonce: '   ' }, session: { nonce: 's-123' } }), 's-123')
      assert.equal(resolveNonce({ session: { nonce: '  s-123  ' } }), 's-123')
    })
  })

  describe('formatCSPDirectives', () => {
    it('should format directives with strict-dynamic and nonce', () => {
      const result = formatCSPDirectives(
        { 'default-src': ["'self'"] },
        { nonce: 'test-nonce' }
      )
      assert.ok(result.includes("script-src 'self' 'strict-dynamic' 'nonce-test-nonce'"))
      assert.ok(result.includes("style-src 'self' 'nonce-test-nonce'"))
    })

    it('should format directives with script/style hashes', () => {
      const result = formatCSPDirectives(
        {},
        { scriptHashes: ["'sha256-abc'"], styleHashes: ["'sha256-xyz'"] }
      )
      assert.ok(result.includes("script-src 'self' 'sha256-abc'"))
      assert.ok(result.includes("style-src 'self' 'sha256-xyz'"))
    })

    it('should strip unsupported directives when forMeta is true', () => {
      const directives = {
        'default-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'report-uri': ['/csp-report'],
        'report-to': ['csp-endpoint'],
        sandbox: ['allow-scripts']
      }

      const headerResult = formatCSPDirectives(directives, { forMeta: false })
      assert.ok(headerResult.includes("frame-ancestors 'none'"))
      assert.ok(headerResult.includes('report-uri /csp-report'))
      assert.ok(headerResult.includes('report-to csp-endpoint'))
      assert.ok(headerResult.includes('sandbox allow-scripts'))

      const metaResult = formatCSPDirectives(directives, { forMeta: true })
      assert.ok(metaResult.includes("default-src 'self'"))
      assert.ok(!metaResult.includes('frame-ancestors'))
      assert.ok(!metaResult.includes('report-uri'))
      assert.ok(!metaResult.includes('report-to'))
      assert.ok(!metaResult.includes('sandbox'))
    })

    it('should deduplicate hashes and nonces already present in directives', () => {
      const result = formatCSPDirectives(
        { 'script-src': ["'self'", "'strict-dynamic'", "'nonce-abc'"] },
        { nonce: 'abc' }
      )
      const scriptSrc = result.split('; ').find(d => d.startsWith('script-src '))
      assert.equal(scriptSrc.split(' ').filter(s => s === "'nonce-abc'").length, 1)
      assert.equal(scriptSrc.split(' ').filter(s => s === "'strict-dynamic'").length, 1)
    })

    it('should coerce string directive values to arrays and preserve user sources alongside a nonce', () => {
      const result = formatCSPDirectives(
        { 'img-src': 'https://cdn.example.com', 'script-src': ["'unsafe-inline'"] },
        { nonce: 'n1' }
      )
      assert.ok(result.includes('img-src https://cdn.example.com'))
      assert.ok(result.includes("script-src 'unsafe-inline' 'strict-dynamic' 'nonce-n1'"))
    })

    it('should filter out directives with empty source lists', () => {
      const result = formatCSPDirectives({ 'img-src': [], 'default-src': ["'self'"] })
      assert.ok(!result.includes('img-src'))
      assert.ok(result.includes("default-src 'self'"))
    })
  })

  describe('injectCSPMeta', () => {
    it('should inject meta CSP tag into head or root', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', attribs: {}, children: [] })
      const head = createCoraliteElement({ type: 'tag', name: 'head', parent: root, attribs: {}, children: [] })
      root.children.push(head)

      injectCSPMeta(root, head, "script-src 'self'", false)
      assert.equal(head.children[0].name, 'meta')
      assert.equal(head.children[0].attribs['http-equiv'], 'Content-Security-Policy')
      assert.equal(head.children[0].attribs.content, "script-src 'self'")
    })

    it('should skip injection when cspContent is empty or whitespace', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', attribs: {}, children: [] })
      const head = createCoraliteElement({ type: 'tag', name: 'head', parent: root, attribs: {}, children: [] })
      root.children.push(head)

      injectCSPMeta(root, head, '', false)
      assert.equal(head.children.length, 0)

      injectCSPMeta(root, head, '   ', false)
      assert.equal(head.children.length, 0)
    })

    it('should use the Report-Only http-equiv when reportOnly is true', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', attribs: {}, children: [] })
      const head = createCoraliteElement({ type: 'tag', name: 'head', parent: root, attribs: {}, children: [] })
      root.children.push(head)

      injectCSPMeta(root, head, "script-src 'self'", true)
      assert.equal(head.children[0].attribs['http-equiv'], 'Content-Security-Policy-Report-Only')
    })

    it('should fall back to the root when head is null', () => {
      const root = createCoraliteElement({ type: 'tag', name: 'html', attribs: {}, children: [] })

      injectCSPMeta(root, null, "script-src 'self'", false)
      assert.equal(root.children[0].name, 'meta')
      assert.equal(root.children[0].attribs['http-equiv'], 'Content-Security-Policy')
    })
  })

  describe('defineConfig validation for csp', () => {
    it('should validate valid csp object', () => {
      const cfg = defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        csp: {
          enabled: true,
          nonce: '123',
          hashAlgorithm: 'sha256',
          injectMeta: true,
          reportOnly: false,
          externalScripts: true,
          externalStyles: true,
          directives: { 'script-src': ["'self'"] }
        }
      })
      assert.ok(cfg.csp)
    })

    it('should throw on invalid csp properties', () => {
      assert.throws(() => {
        defineConfig({
          output: 'dist',
          components: 'components',
          pages: 'pages',
          // @ts-ignore
          csp: 'invalid'
        })
      }, /Config property "csp" must be an object/)

      assert.throws(() => {
        defineConfig({
          output: 'dist',
          components: 'components',
          pages: 'pages',
          csp: {
            // @ts-ignore
            hashAlgorithm: 'invalid-algo'
          }
        })
      }, /Invalid csp.hashAlgorithm/)
    })
  })
})
