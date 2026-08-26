import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  validatePageSource,
  validatePagesDir,
  formatPageValidationReport
} from '../../../lib/page-validator.js'

describe('Coralite Page Validator (page-validator.js)', () => {
  describe('CORALITE-PAGE-101: Unknown Custom Element', () => {
    it('emits warning when unknown custom element is present without fuzzy match', () => {
      const source = `
        <!DOCTYPE html>
        <html>
          <body>
            <unknown-element></unknown-element>
          </body>
        </html>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', { attributes: {} }]
        ])
      })

      assert.equal(result.valid, false)
      const warning = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-101')
      assert.ok(warning)
      assert.equal(warning.severity, 'warning')
      assert.equal(warning.message, 'Unknown custom element tag "<unknown-element>"')
    })

    it('emits fuzzy match suggestion when close match exists (Levenshtein distance)', () => {
      const source = `
        <div>
          <user-profil></user-profil>
        </div>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-profile', { attributes: {} }]
        ])
      })

      const warning = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-101')
      assert.ok(warning)
      assert.equal(warning.message, 'Unknown custom element tag "<user-profil>". Did you mean "<user-profile>"?')
    })

    it('skips custom elements carrying an ignored attribute (ignoreAttributes)', () => {
      const source = `
        <third-party-widget no-hydration></third-party-widget>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map(),
        ignoreAttributes: ['no-hydration']
      })

      assert.equal(result.valid, true)
      assert.equal(result.diagnostics.length, 0)
    })

    it('ignores custom element tags enclosed within HTML comments', () => {
      const source = `
        <!-- <coralite-card></coralite-card> -->
        <!-- <unknown-widget></unknown-widget> -->
        <div>Valid HTML</div>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['coralite-card', { attributes: { title: { required: true } } }]
        ])
      })

      assert.equal(result.valid, true)
      assert.equal(result.diagnostics.length, 0)
    })
  })

  describe('CORALITE-PAGE-102: Missing Required Attribute', () => {
    it('emits error and fix when required attribute is missing from known element tag', () => {
      const source = `
        <user-card></user-card>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', {
            attributes: {
              userId: { type: Number, required: true }
            }
          }]
        ])
      })

      assert.equal(result.valid, false)
      const error = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-102')
      assert.ok(error)
      assert.equal(error.severity, 'error')
      assert.equal(error.message, "Missing required attribute 'user-id' on <user-card>.")
      assert.deepEqual(error.fix, {
        action: 'add_required_attribute',
        description: "Add required attribute 'user-id' to <user-card>",
        replacement: 'user-id=""'
      })
    })

    it('passes validation when required attribute is present as boolean or explicit value', () => {
      const source = `
        <user-card user-id="42"></user-card>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', {
            attributes: {
              userId: { type: Number, required: true }
            }
          }]
        ])
      })

      assert.equal(result.valid, true)
      assert.equal(result.diagnostics.length, 0)
    })
  })

  describe('CORALITE-PAGE-201: Encapsulation Violations in Script Tags', () => {
    it('detects compound descendant selectors targeting inside custom elements', () => {
      const source = `
        <user-card id="card"></user-card>
        <script>
          const el = document.querySelector('user-card .title');
        </script>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', { attributes: {} }]
        ])
      })

      assert.equal(result.valid, false)
      const error = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-201')
      assert.ok(error)
      assert.equal(error.severity, 'error')
      assert.match(error.message, /Encapsulation violation/)
    })

    it('detects direct component mutation via .setAttribute call', () => {
      const source = `
        <user-card id="card"></user-card>
        <script>
          const userCard = document.querySelector('#card');
          userCard.setAttribute('data-foo', 'bar');
        </script>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', { attributes: {} }]
        ])
      })

      const error = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-201')
      assert.ok(error)
      assert.match(error.message, /setAttribute/)
    })

    it('detects direct component mutation via .innerHTML assignment', () => {
      const source = `
        <script>
          const userCard = document.querySelector('user-card');
          userCard.innerHTML = '<span>Injected</span>';
        </script>
      `
      const result = validatePageSource(source, {
        knownComponents: new Map([
          ['user-card', { attributes: {} }]
        ])
      })

      const error = result.diagnostics.find(d => d.code === 'CORALITE-PAGE-201')
      assert.ok(error)
      assert.match(error.message, /\.innerHTML/)
    })
  })

  describe('validatePagesDir & formatPageValidationReport', () => {
    it('validates a directory of pages recursively', async () => {
      const tmpDir = join(tmpdir(), `coralite-page-val-test-${Date.now()}`)
      mkdirSync(tmpDir, { recursive: true })

      const page1 = join(tmpDir, 'index.html')
      const page2 = join(tmpDir, 'profile.html')

      writeFileSync(page1, '<user-card user-id="10"></user-card>')
      writeFileSync(page2, '<user-card></user-card>')

      const report = await validatePagesDir(tmpDir, {
        knownComponents: new Map([
          ['user-card', { attributes: { userId: { required: true } } }]
        ])
      })

      assert.equal(report.summary.totalPages, 2)
      assert.equal(report.summary.validPages, 1)
      assert.equal(report.summary.errorCount, 1)

      const formatted = formatPageValidationReport(report)
      assert.ok(typeof formatted === 'string')
      assert.match(formatted, /Coralite Page Validation Report/)

      rmSync(tmpDir, { recursive: true, force: true })
    })
  })
})
