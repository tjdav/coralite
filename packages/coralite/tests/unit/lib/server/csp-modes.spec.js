import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defineConfig } from '../../../../lib/server/config.js'
import { resolveCspConfig } from '../../../../lib/server/utils/csp.js'
import { createCoralite } from '../../../../lib/index.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../../../fixtures/csp-modes')

describe('CSP Modes Configuration & Resolution', () => {
  describe('Config Validation', () => {
    it('accepts valid csp.modes configuration', () => {
      const config = defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        csp: {
          enabled: true,
          directives: {
            'default-src': ["'self'"]
          },
          modes: {
            development: {
              enabled: false
            },
            testing: {
              directives: {
                'script-src': ["'self'", "'wasm-unsafe-eval'"]
              }
            },
            production: {
              reportOnly: true
            }
          }
        }
      })

      assert.equal(config.csp.modes.development.enabled, false)
      assert.deepEqual(config.csp.modes.testing.directives['script-src'], ["'self'", "'wasm-unsafe-eval'"])
    })

    it('throws CORALITE-CFG-001 for unknown mode key in csp.modes', () => {
      assert.throws(() => {
        defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          csp: {
            modes: {
              staging: {
                enabled: true
              }
            }
          }
        })
      }, (err) => {
        assert.equal(err.code, 'CORALITE-CFG-001')
        assert.ok(err.message.includes('Unknown mode key "staging" in csp.modes'))
        return true
      })
    })

    it('throws CORALITE-CFG-002 for recursive modes key inside a mode override', () => {
      assert.throws(() => {
        defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          csp: {
            modes: {
              development: {
                modes: {
                  testing: {}
                }
              }
            }
          }
        })
      }, (err) => {
        assert.equal(err.code, 'CORALITE-CFG-002')
        assert.ok(err.message.includes('Recursive "modes" key is not allowed in csp.modes.development'))
        return true
      })
    })

    it('throws CORALITE-CFG-003 for unknown CSP key inside a mode override', () => {
      assert.throws(() => {
        defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          csp: {
            modes: {
              testing: {
                invalidKey: true
              }
            }
          }
        })
      }, (err) => {
        assert.equal(err.code, 'CORALITE-CFG-003')
        assert.ok(err.message.includes('Unknown CSP config key "invalidKey" in csp.modes.testing'))
        return true
      })
    })
  })

  describe('resolveCspConfig Resolution & Merge', () => {
    it('uses base object unchanged when csp.modes is missing', () => {
      const base = {
        enabled: true,
        hashAlgorithm: 'sha256',
        directives: {
          'default-src': ["'self'"]
        }
      }

      const resolved = resolveCspConfig(base, 'development')
      assert.equal(resolved.enabled, true)
      assert.equal(resolved.hashAlgorithm, 'sha256')
      assert.deepEqual(resolved.directives, { 'default-src': ["'self'"] })
    })

    it('resolves modes.development.enabled = false to enabled: false', () => {
      const base = {
        enabled: true,
        modes: {
          development: {
            enabled: false
          }
        }
      }

      const resolved = resolveCspConfig(base, 'development')
      assert.equal(resolved.enabled, false)
    })

    it('replaces directive keys completely while inheriting unmentioned keys from base', () => {
      const base = {
        enabled: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"]
        },
        modes: {
          testing: {
            directives: {
              'script-src': ["'self'", "'wasm-unsafe-eval'"],
              'connect-src': ["'self'", 'ws:', 'http:']
            }
          }
        }
      }

      const resolved = resolveCspConfig(base, 'testing')
      assert.deepEqual(resolved.directives, {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
        'style-src': ["'self'"],
        'connect-src': ["'self'", 'ws:', 'http:']
      })
    })

    it('inherits base object when mode override is absent', () => {
      const base = {
        enabled: true,
        hashAlgorithm: 'sha384',
        directives: {
          'default-src': ["'self'"]
        },
        modes: {
          development: {
            enabled: false
          }
        }
      }

      const resolved = resolveCspConfig(base, 'production')
      assert.equal(resolved.enabled, true)
      assert.equal(resolved.hashAlgorithm, 'sha384')
      assert.deepEqual(resolved.directives, { 'default-src': ["'self'"] })
    })

    it('replaces scalar keys and nonce with mode override values', () => {
      const base = {
        enabled: true,
        hashAlgorithm: 'sha256',
        injectMeta: true,
        reportOnly: false,
        externalScripts: false,
        externalStyles: false,
        nonce: 'base-nonce',
        modes: {
          testing: {
            hashAlgorithm: 'sha512',
            injectMeta: false,
            reportOnly: true,
            externalScripts: true,
            externalStyles: true,
            nonce: 'test-nonce'
          }
        }
      }

      const resolved = resolveCspConfig(base, 'testing')
      assert.equal(resolved.hashAlgorithm, 'sha512')
      assert.equal(resolved.injectMeta, false)
      assert.equal(resolved.reportOnly, true)
      assert.equal(resolved.externalScripts, true)
      assert.equal(resolved.externalStyles, true)
      assert.equal(resolved.nonce, 'test-nonce')
    })
  })

  describe('Page Rendering with CSP Modes', () => {
    it('applies mode overrides at page render time for testing mode', async () => {
      const coralite = await createCoralite({
        components: path.join(fixturesDir, '../components'),
        pages: fixturesDir,
        mode: 'testing',
        incremental: false,
        csp: {
          enabled: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'"]
          },
          modes: {
            testing: {
              directives: {
                'script-src': ["'self'", "'wasm-unsafe-eval'"]
              }
            }
          }
        }
      })

      const results = await coralite.build()
      const testingPage = results.find(r => r.path.pathname.includes('testing-wasm'))
      assert.ok(testingPage, 'testing-wasm.html should build')
      assert.ok(testingPage.csp, 'CSP result should be present')
      assert.ok(testingPage.csp.header.includes("'wasm-unsafe-eval'"), 'CSP header contains wasm-unsafe-eval')
      assert.ok(testingPage.csp.directives['script-src'].includes("'wasm-unsafe-eval'"))
    })
  })
})
