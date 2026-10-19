import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPluginFixes } from '../../../lib/plugin-fixer.js'
import { validatePluginSource } from '../../../lib/plugin-validator.js'
import { generateColorizedDiff } from '../../../lib/component-fixer.js'

describe('Plugin Fixer Engine (applyPluginFixes)', () => {
  test('CORALITE-P201: transforms single-phase context into Two-Phase curried function (arrow function expression)', () => {
    const input = `
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'my-plugin',
  server: {
    context: (ctx) => ({ count: 1 })
  }
})`

    const result = applyPluginFixes(input, null, { filePath: 'my-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('context: (ctx) => (instanceContext) => ({ count: 1 })'))
    assert.strictEqual(result.fixesApplied.length, 1)
    assert.strictEqual(result.fixesApplied[0].code, 'CORALITE-P201')

    const postValidation = validatePluginSource(result.outputCode, 'my-plugin.js')
    const postP201s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-P201')
    assert.strictEqual(postP201s.length, 0)
  })

  test('CORALITE-P201: transforms single-phase context into Two-Phase curried function (block body function)', () => {
    const input = `
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'block-plugin',
  client: {
    context: (pluginContext) => {
      const initial = 10;
      return { initial };
    }
  }
})`

    const result = applyPluginFixes(input, null, { filePath: 'block-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('context: (pluginContext) => (instanceContext) => {\n'))

    const postValidation = validatePluginSource(result.outputCode, 'block-plugin.js')
    const postP201s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-P201')
    assert.strictEqual(postP201s.length, 0)
  })

  test('CORALITE-P401: wraps returned raw object in definePlugin and injects import statement at top', () => {
    const input = `
export default {
  name: 'raw-object-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'raw-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({\n  name: \'raw-object-plugin\','))
    assert.strictEqual(result.fixesApplied.length, 1)
    assert.strictEqual(result.fixesApplied[0].code, 'CORALITE-P401')

    const postValidation = validatePluginSource(result.outputCode, 'raw-plugin.js')
    const postP401s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-P401')
    assert.strictEqual(postP401s.length, 0)
  })

  test('CORALITE-P401: appends definePlugin to existing coralite import specifiers', () => {
    const input = `
import { createCoralite } from 'coralite'

export default {
  name: 'existing-import-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'existing-import-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { createCoralite, definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })

  test('CORALITE-P401: wraps object returned inside plugin factory function', () => {
    const input = `
import { createCoralite } from 'coralite'

export default function myPluginFactory(options = {}) {
  return {
    name: 'factory-plugin',
    server: {}
  }
}`

    const result = applyPluginFixes(input, null, { filePath: 'factory-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { createCoralite, definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('return definePlugin({'))
  })

  test('Multi-fix processing: resolves both CORALITE-P401 and CORALITE-P201 in a single invocation', () => {
    const input = `
export default {
  name: 'multi-fix-plugin',
  server: {
    context: (ctx) => ({ foo: 1 })
  }
}`

    const result = applyPluginFixes(input, null, { filePath: 'multi-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
    assert.ok(result.outputCode.includes('context: (ctx) => (instanceContext) => ({ foo: 1 })'))
    assert.strictEqual(result.fixesApplied.length, 2)
  })

  test('dryRun support: generates colorized diff preview', () => {
    const oldCode = `
export default {
  name: 'dry-run-plugin'
}`

    const fixRes = applyPluginFixes(oldCode, null, { filePath: 'dry-run-plugin.js', dryRun: true })
    assert.strictEqual(fixRes.modified, true)
    assert.ok(fixRes.diff.includes('[DRY-RUN PREVIEW] dry-run-plugin.js'))
    assert.ok(fixRes.diff.includes('+ import { definePlugin } from \'coralite\''))

    const diff = generateColorizedDiff('old', 'new', 'test.js')
    assert.ok(diff.includes('[DRY-RUN PREVIEW] test.js'))
  })

  test('CORALITE-P401: preserves aliased imports when appending definePlugin', () => {
    const input = `
import { createCoralite as init } from 'coralite'

export default {
  name: 'aliased-import-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'aliased-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { createCoralite as init, definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })

  test('CORALITE-P401: prepends new import when existing coralite import is default import', () => {
    const input = `
import coralite from 'coralite'

export default {
  name: 'default-import-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'default-import-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.startsWith("import { definePlugin } from 'coralite'\n"))
    assert.ok(result.outputCode.includes("import coralite from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })

  test('CORALITE-P401: prepends new import when existing coralite import is namespace import', () => {
    const input = `
import * as coralite from 'coralite'

export default {
  name: 'namespace-import-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'namespace-import-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.startsWith("import { definePlugin } from 'coralite'\n"))
    assert.ok(result.outputCode.includes("import * as coralite from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })

  test('CORALITE-P401: prepends new import when existing coralite import is side-effect-only import', () => {
    const input = `
import 'coralite'

export default {
  name: 'side-effect-import-plugin',
  server: {}
}`

    const result = applyPluginFixes(input, null, { filePath: 'side-effect-import-plugin.js' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.startsWith("import { definePlugin } from 'coralite'\n"))
    assert.ok(result.outputCode.includes("import 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })

  test('CORALITE-P401: skips import injection when definePlugin is already imported or aliased', () => {
    const inputDirect = `
import { definePlugin } from 'coralite'

export default {
  name: 'already-imported-plugin',
  server: {}
}`

    const resDirect = applyPluginFixes(inputDirect, null, { filePath: 'already-imported.js' })
    assert.strictEqual(resDirect.modified, true)
    assert.ok(resDirect.outputCode.includes("import { definePlugin } from 'coralite'"))
    assert.strictEqual(resDirect.outputCode.match(/^import\b/gm).length, 1)

    const inputAliased = `
import { definePlugin as dp } from 'coralite'

export default {
  name: 'aliased-define-plugin',
  server: {}
}`

    const resAliased = applyPluginFixes(inputAliased, null, { filePath: 'aliased-define.js' })
    assert.strictEqual(resAliased.modified, true)
    assert.ok(resAliased.outputCode.includes("import { definePlugin as dp } from 'coralite'"))
    assert.strictEqual(resAliased.outputCode.match(/^import\b/gm).length, 1)
  })

  test('CORALITE-P401: adversarial ReDoS canary processes comment storm in sub-second time', () => {
    const commentStorm = '// import { foo } from \'coralite\'\n'.repeat(20000)
    const code = `${commentStorm}\nexport default {\n  name: 'redos-canary-plugin'\n}`

    const start = performance.now()
    const result = applyPluginFixes(code, null, { filePath: 'redos-canary.js' })
    const durationMs = performance.now() - start

    assert.ok(durationMs < 2000, `Expected ReDoS canary to run under 2000ms, took ${durationMs}ms`)
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes("import { definePlugin } from 'coralite'"))
    assert.ok(result.outputCode.includes('export default definePlugin({'))
  })
})
