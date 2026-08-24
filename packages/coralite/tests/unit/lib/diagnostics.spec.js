import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { buildCodeframe, formatDiagnosticTerminal, formatValidationReport } from '../../../lib/utils/diagnostics.js'

describe('Diagnostics Module', () => {
  describe('buildCodeframe', () => {
    const sampleSource = [
      '<template id="user-card">',
      '  <div class="card">',
      '    <h2>{{ user.profile.name }}</h2>',
      '    <p>{{ user.bio }}</p>',
      '  </div>',
      '</template>'
    ].join('\n')

    it('builds codeframe around target line with default radius', () => {
      const codeframe = buildCodeframe(sampleSource, 3, 12)
      assert.ok(codeframe.includes(' >    3 |     <h2>{{ user.profile.name }}</h2>'))
      assert.ok(codeframe.includes('       |            ^'))
      assert.ok(codeframe.includes('      1 | <template id="user-card">'))
      assert.ok(codeframe.includes('      4 |     <p>{{ user.bio }}</p>'))
      assert.ok(!codeframe.includes('      6 | </template>'))
    })

    it('respects custom radius', () => {
      const codeframe = buildCodeframe(sampleSource, 3, 12, 1)
      assert.ok(codeframe.includes(' >    3 |     <h2>{{ user.profile.name }}</h2>'))
      assert.ok(codeframe.includes('      2 |   <div class="card">'))
      assert.ok(codeframe.includes('      4 |     <p>{{ user.bio }}</p>'))
      assert.ok(!codeframe.includes('      1 | <template'))
      assert.ok(!codeframe.includes('      5 |   </div>'))
    })

    it('omits column caret pointer when column is missing or <= 0', () => {
      const codeframe = buildCodeframe(sampleSource, 3, 0)
      assert.ok(codeframe.includes(' >    3 |     <h2>{{ user.profile.name }}</h2>'))
      assert.ok(!codeframe.includes('^'))
    })

    it('returns empty string for empty source', () => {
      assert.strictEqual(buildCodeframe('', 1, 1), '')
      assert.strictEqual(buildCodeframe(null, 1, 1), '')
      assert.strictEqual(buildCodeframe(undefined, 1, 1), '')
    })

    it('returns empty string for out of bounds line numbers', () => {
      assert.strictEqual(buildCodeframe(sampleSource, 0, 1), '')
      assert.strictEqual(buildCodeframe(sampleSource, 10, 1), '')
      assert.strictEqual(buildCodeframe(sampleSource, -2, 1), '')
    })
  })

  describe('formatDiagnosticTerminal', () => {
    it('formats full diagnostic with codeframe, cause, and fix', () => {
      const diag = {
        code: 'CORALITE-E201',
        severity: 'error',
        message: 'Dumb Template Violation',
        filePath: 'src/components/user-card.html',
        line: 3,
        column: 12,
        codeframe: '   1 | <template>\n > 3 | <h2>{{ user.profile.name }}</h2>\n       |            ^',
        cause: 'Templates are strictly declarative flat tokens.',
        fix: {
          description: "Lift expression 'user.profile.name' to getter 'userName'",
          action: 'lift_to_getter',
          getter: {
            name: 'userName',
            code: '(state) => state.user?.profile?.name ?? \'\''
          }
        }
      }

      const formatted = formatDiagnosticTerminal(diag)
      assert.ok(formatted.includes('┌─ [CORALITE-E201] Dumb Template Violation'))
      assert.ok(formatted.includes('│ File: src/components/user-card.html:3:12'))
      assert.ok(formatted.includes('├─ Code Context'))
      assert.ok(formatted.includes('<h2>{{ user.profile.name }}</h2>'))
      assert.ok(formatted.includes('├─ Why this failed'))
      assert.ok(formatted.includes('│ Templates are strictly declarative flat tokens.'))
      assert.ok(formatted.includes('├─ Suggested 1-Shot Fix'))
      assert.ok(formatted.includes('│ Lift expression \'user.profile.name\' to getter \'userName\''))
      assert.ok(formatted.includes('│ userName: (state) => state.user?.profile?.name ?? \'\''))
      assert.ok(formatted.includes('└─'))
    })

    it('omits optional sections when fields are absent', () => {
      const diag = {
        code: 'CORALITE-W101',
        severity: 'warning',
        message: 'Unused Attribute Warning',
        filePath: 'src/components/btn.html'
      }

      const formatted = formatDiagnosticTerminal(diag)
      assert.ok(formatted.includes('┌─ [CORALITE-W101] Unused Attribute Warning'))
      assert.ok(formatted.includes('│ File: src/components/btn.html'))
      assert.ok(!formatted.includes('├─ Code Context'))
      assert.ok(!formatted.includes('├─ Why this failed'))
      assert.ok(!formatted.includes('├─ Suggested 1-Shot Fix'))
      assert.ok(formatted.includes('└─'))
    })

    it('returns empty string when diagnostic is falsy', () => {
      assert.strictEqual(formatDiagnosticTerminal(null), '')
      assert.strictEqual(formatDiagnosticTerminal(undefined), '')
    })
  })

  describe('formatValidationReport', () => {
    const sampleReport = {
      components: [
        {
          filePath: 'src/components/user-card.html',
          valid: false,
          diagnostics: [
            {
              code: 'CORALITE-E201',
              severity: 'error',
              message: 'Dumb Template Violation',
              filePath: 'src/components/user-card.html',
              line: 3,
              column: 12,
              cause: 'Complex template expressions strictly disallowed.',
              fix: {
                description: 'Extract expression to getter',
                action: 'lift_to_getter'
              }
            }
          ]
        },
        {
          filePath: 'src/components/button.html',
          valid: true,
          diagnostics: []
        }
      ],
      summary: {
        totalComponents: 2,
        validComponents: 1,
        errorCount: 1,
        warningCount: 0,
        fixableCount: 1,
        usageCoveragePercentage: 85
      }
    }

    it('serializes to JSON when format option is "json"', () => {
      const jsonReport = formatValidationReport(sampleReport, { format: 'json' })
      const parsed = JSON.parse(jsonReport)
      assert.strictEqual(parsed.components.length, 2)
      assert.strictEqual(parsed.summary.totalComponents, 2)
    })

    it('formats terminal text output with summary statistics by default', () => {
      const terminalReport = formatValidationReport(sampleReport)
      assert.ok(terminalReport.includes('🪸 Coralite Component Code & Schema Diagnostics'))
      assert.ok(terminalReport.includes('src/components/user-card.html'))
      assert.ok(terminalReport.includes('[CORALITE-E201] Dumb Template Violation'))
      assert.ok(terminalReport.includes('src/components/button.html'))
      assert.ok(terminalReport.includes('✔ All symbols and template syntax valid.'))
      assert.ok(terminalReport.includes('Summary: 2 component(s) validated | 1 valid | 1 error(s) | 0 warning(s) | 1 fixable with --fix'))
    })
  })
})
