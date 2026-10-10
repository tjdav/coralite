import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripAnsi,
  isSemanticMatch,
  buildCodeframe,
  formatDiagnosticTerminal,
  formatValidationReport,
  extractInlineExpression
} from '../../../lib/utils/diagnostics.js'

describe('diagnostics utilities', () => {
  describe('extractInlineExpression', () => {
    it('returns null for null, undefined, empty, or non-string inputs', () => {
      assert.equal(extractInlineExpression(null), null)
      assert.equal(extractInlineExpression(undefined), null)
      assert.equal(extractInlineExpression(''), null)
      // @ts-ignore
      assert.equal(extractInlineExpression(123), null)
    })

    it('extracts expression from standard single-line diagnostic message', () => {
      const msg = "Inline expression '{{ user.name + 1 }}' in template must be lifted to a derived getter."
      assert.equal(extractInlineExpression(msg), 'user.name + 1')
    })

    it('extracts expression from multi-line diagnostic message', () => {
      const msg = "Inline expression '{{\n  user.isVip\n    ? `VIP: ${user.name}`\n    : user.name\n}}' in template must be lifted."
      assert.equal(extractInlineExpression(msg), 'user.isVip\n    ? `VIP: ${user.name}`\n    : user.name')
    })

    it('returns null if expression inside delimiters is whitespace only', () => {
      const msg = "Inline expression '{{   }}' in template must be lifted."
      assert.equal(extractInlineExpression(msg), null)
    })

    it('returns null when message does not contain inline expression pattern', () => {
      const msg = 'Unused server property count.'
      assert.equal(extractInlineExpression(msg), null)
    })
  })

  describe('stripAnsi', () => {
    it('strips ANSI color and style codes from string', () => {
      const colored = '\x1b[31m\x1b[1mError:\x1b[0m Something went wrong'
      assert.equal(stripAnsi(colored), 'Error: Something went wrong')
    })

    it('returns empty string for non-string inputs', () => {
      assert.equal(stripAnsi(null), '')
      assert.equal(stripAnsi(undefined), '')
      assert.equal(stripAnsi(123), '')
    })
  })

  describe('isSemanticMatch', () => {
    it('matches refName to tagName directly (case-insensitive)', () => {
      assert.equal(isSemanticMatch('button', 'BUTTON'), true)
      assert.equal(isSemanticMatch('Button', 'button'), true)
      assert.equal(isSemanticMatch('div', 'span'), false)
    })

    it('matches developer ref abbreviations to tag synonyms', () => {
      assert.equal(isSemanticMatch('btn', 'button'), true)
      assert.equal(isSemanticMatch('btn', 'input'), true)
      assert.equal(isSemanticMatch('inp', 'textarea'), true)
      assert.equal(isSemanticMatch('img', 'svg'), true)
      assert.equal(isSemanticMatch('link', 'a'), true)
      assert.equal(isSemanticMatch('nav', 'ul'), true)
    })

    it('matches camelCase or kebab-case ref names using words and synonyms', () => {
      assert.equal(isSemanticMatch('submitBtn', 'button'), true)
      assert.equal(isSemanticMatch('user-form', 'form'), true)
      assert.equal(isSemanticMatch('profileImage', 'img'), true)
    })

    it('matches attribs.id using substring and token matching', () => {
      assert.equal(isSemanticMatch('userProfile', 'div', { id: 'user-profile-card' }), true)
      assert.equal(isSemanticMatch('submit', 'div', { id: 'btn-submit-action' }), true)
      assert.equal(isSemanticMatch('xyz', 'div', { id: 'main-header' }), false)
    })

    it('matches attribs.class using token matching', () => {
      assert.equal(isSemanticMatch('btn', 'div', { class: 'btn primary-btn' }), true)
      assert.equal(isSemanticMatch('primaryBtn', 'div', { class: 'btn primary' }), true)
      assert.equal(isSemanticMatch('foo', 'div', { class: 'bar baz' }), false)
    })

    it('returns false for invalid refName', () => {
      assert.equal(isSemanticMatch('', 'button'), false)
      assert.equal(isSemanticMatch(null, 'button'), false)
    })
  })

  describe('buildCodeframe', () => {
    it('returns formatted codeframe with line numbers and red arrow for target line', () => {
      const source = 'const x = 1;\nconst y = 2;\nconst z = 3;'
      const codeframe = buildCodeframe(source, 2, 7)
      const clean = stripAnsi(codeframe)

      assert.ok(clean.includes(' >    2 | const y = 2;'))
      assert.ok(clean.includes('       |       ^'))
      assert.ok(clean.includes('      1 | const x = 1;'))
      assert.ok(clean.includes('      3 | const z = 3;'))
    })

    it('returns empty string for invalid line numbers or source', () => {
      assert.equal(buildCodeframe('', 1), '')
      assert.equal(buildCodeframe('code', 0), '')
      assert.equal(buildCodeframe('code', 10), '')
    })
  })

  describe('formatDiagnosticTerminal', () => {
    it('formats diagnostic into 4-part ANSI box', () => {
      const diagnostic = {
        code: 'CORALITE-E201',
        severity: 'error',
        message: 'Template expression requires getter lifting',
        filePath: 'components/card.html',
        line: 12,
        column: 5,
        codeframe: ' >   12 | {{ count + 1 }}',
        cause: 'Inline expressions are restricted.',
        fix: {
          description: 'Lift expression to getter',
          action: 'lift_to_getter',
          replacement: '{{ countPlusOne }}',
          getter: { name: 'countPlusOne', code: 'get countPlusOne() { return this.state.count + 1 }' }
        }
      }

      const formatted = formatDiagnosticTerminal(diagnostic)
      const clean = stripAnsi(formatted)

      assert.ok(clean.includes('┌─ [CORALITE-E201] Template expression requires getter lifting'))
      assert.ok(clean.includes('│ File: components/card.html:12:5'))
      assert.ok(clean.includes('├─ Code Context'))
      assert.ok(clean.includes(' >   12 | {{ count + 1 }}'))
      assert.ok(clean.includes('├─ Why this failed'))
      assert.ok(clean.includes('│ Inline expressions are restricted.'))
      assert.ok(clean.includes('├─ Suggested 1-Shot Fix'))
      assert.ok(clean.includes('│ Lift expression to getter'))
      assert.ok(clean.includes('│ countPlusOne: get countPlusOne() { return this.state.count + 1 }'))
      assert.ok(clean.startsWith('┌─'))
      assert.ok(clean.endsWith('─'))
    })

    it('returns empty string for missing diagnostic', () => {
      assert.equal(formatDiagnosticTerminal(null), '')
    })
  })

  describe('formatValidationReport', () => {
    it('returns JSON string when format is json', () => {
      const report = {
        components: [],
        summary: { totalComponents: 0, validComponents: 0, errorCount: 0, warningCount: 0, fixableCount: 0, usageCoveragePercentage: 100 }
      }
      const json = formatValidationReport(report, { format: 'json' })
      assert.equal(typeof json, 'string')
      assert.deepEqual(JSON.parse(json), report)
    })

    it('formats console report and correctly calculates fixableCount based on fix.action', () => {
      const report = {
        components: [
          {
            filePath: 'src/card.html',
            valid: false,
            diagnostics: [
              {
                code: 'CORALITE-E201',
                severity: 'error',
                message: 'Expression error',
                fix: { description: 'Fix auto', action: 'lift_to_getter' }
              },
              {
                code: 'CORALITE-P201',
                severity: 'error',
                message: 'Plugin context error',
                fix: { description: 'Wrap context', action: 'wrap_two_phase_context' }
              },
              {
                code: 'CORALITE-E102',
                severity: 'warning',
                message: 'Attribute error',
                fix: { description: 'Add required attribute', action: 'add_required_attribute' }
              },
              {
                code: 'CORALITE-W401',
                severity: 'warning',
                message: 'Unused symbol',
                fix: { description: 'Guidance only fix' }
              }
            ]
          }
        ]
      }

      const formatted = formatValidationReport(report, { format: 'console' })
      const clean = stripAnsi(formatted)

      assert.ok(clean.includes('Summary: 1 component(s) validated | 0 valid | 2 error(s) | 2 warning(s) | 3 fixable with --fix'))
    })
  })
})
