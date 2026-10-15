import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateComponentFile } from '../../../../../lib/server/component/validator.js'
import { checkCommand } from '../../../../../lib/cli/commands/check.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesDir = join(__dirname, '../../../../fixtures/validator')

describe('CORALITE-W501 Reserved Prefix Validator Pass', () => {
  test('fires CORALITE-W501 for coralite- prefix', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-coralite.html')
    const result = await validateComponentFile(fixturePath)

    const w501 = result.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.ok(w501, 'Expected CORALITE-W501 diagnostic')
    assert.equal(w501.severity, 'warning')
    assert.equal(
      w501.message,
      'Component tag "coralite-button" uses the reserved "coralite-" prefix. Use a project-specific prefix like "site-" or "ui-" instead.'
    )
    assert.equal(w501.line, 1)
    assert.equal(w501.column, 15)
  })

  test('fires CORALITE-W501 for c- prefix', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-c.html')
    const result = await validateComponentFile(fixturePath)

    const w501 = result.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.ok(w501, 'Expected CORALITE-W501 diagnostic')
    assert.equal(w501.severity, 'warning')
    assert.equal(
      w501.message,
      'Component tag "c-button" uses the reserved "c-" prefix. Use a project-specific prefix like "ui-" or a custom scope instead.'
    )
  })

  test('fires CORALITE-W501 for router- prefix', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-router.html')
    const result = await validateComponentFile(fixturePath)

    const w501 = result.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.ok(w501, 'Expected CORALITE-W501 diagnostic')
    assert.equal(w501.severity, 'warning')
    assert.equal(
      w501.message,
      'Component tag "router-outlet" uses the reserved "router-" prefix. Use a project-specific prefix like "app-" or a custom scope instead.'
    )
  })

  test('does not fire CORALITE-W501 for site- or ui- or my-component prefixes', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-ok.html')
    const result = await validateComponentFile(fixturePath)

    const w501 = result.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.equal(w501, undefined)
  })

  test('does not fire CORALITE-W501 for c-token element', async () => {
    const code = '<template id="c-token"><span>token</span></template>'
    const { validateTemplate } = await import('../../../../../lib/validator/passes/template.js')
    const { createValidationContext } = await import('../../../../../lib/validator/context.js')

    const context = createValidationContext(code, '/app/src/components/c-token.html')
    validateTemplate(context)

    const w501 = context.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.equal(w501, undefined)
  })

  test('suppresses CORALITE-W501 with <!-- coralite-ignore W501 -->', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-ignore.html')
    const result = await validateComponentFile(fixturePath)

    const w501 = result.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.equal(w501, undefined)
  })

  test('does not fire CORALITE-W501 on framework-internal components', async () => {
    const code = '<template id="router-outlet"><div><slot></slot></div></template>'
    const { validateTemplate } = await import('../../../../../lib/validator/passes/template.js')
    const { createValidationContext } = await import('../../../../../lib/validator/context.js')

    const context = createValidationContext(code, '/app/packages/coralite/lib/plugins/router/outlet.html')
    validateTemplate(context)

    const w501 = context.diagnostics.find(d => d.code === 'CORALITE-W501')
    assert.equal(w501, undefined)
  })

  test('--strict escalates W501 warning to failure in checkCommand', async () => {
    const fixturePath = join(fixturesDir, 'reserved-prefix-coralite.html')

    const normalCheck = await checkCommand(null, {
      components: fixturePath,
      pages: false,
      plugins: false,
      strict: false,
      cwd: process.cwd()
    }, {
      write () {
      }
    })

    assert.equal(normalCheck.hasFailures, false, 'Expected no failures without strict mode')

    const strictCheck = await checkCommand(null, {
      components: fixturePath,
      pages: false,
      plugins: false,
      strict: true,
      cwd: process.cwd()
    }, {
      write () {
      }
    })

    assert.equal(strictCheck.hasFailures, true, 'Expected strict check to fail due to W501 warning')
  })
})
