import { describe, test } from 'node:test'
import assert from 'node:assert'
import { applyComponentFixes, generateColorizedDiff } from '../../../lib/component-fixer.js'
import { validateComponentSource } from '../../../lib/component-validator.js'

describe('Component Fixer Engine (applyComponentFixes)', () => {
  test('CORALITE-E201: lifts template expression to getter and injects into getters block', () => {
    const input = `<template>
  <div>{{ user.profile.name }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: { title: { type: String } }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'user-card.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('{{ userProfileName }}'))
    assert.ok(result.outputCode.includes('getters: {'))
    assert.ok(result.outputCode.includes("userProfileName: ({ state }) => state.user?.profile?.name ?? ''"))
    assert.strictEqual(result.fixesApplied.length, 1)
    assert.strictEqual(result.fixesApplied[0].code, 'CORALITE-E201')

    // Verify post-fix validation is clean for E201
    const postValidation = validateComponentSource(result.outputCode, 'user-card.html')
    const postE201s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E201')
    assert.strictEqual(postE201s.length, 0)
  })

  test('CORALITE-E201: lifts multi-line expressions with template literals and ternaries', () => {
    const input = `<template>
  <div>{{
    user.isVip
      ? \`VIP: \${user.name}\`
      : user.name
  }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: { user: { type: Object } }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'multiline-expr.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('getters: {'))
    assert.ok(!result.outputCode.includes('{{ user.isVip'))
    assert.ok(result.outputCode.includes('{{ userIsVipVIPUserNameUserName }}'))
    assert.ok(result.outputCode.includes('state.user?.isVip ? `VIP: ${state.user?.name ?? \'\'}` : state.user?.name'))
  })

  test('CORALITE-E301: rewrites named static import used only in client() to dynamic import inside async client()', () => {
    const input = `<template>
  <div>Date</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'

  export default defineComponent({
    client() {
      const d = formatDate(new Date())
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'date-comp.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(!result.outputCode.includes("import { formatDate } from './utils.js'"))
    assert.ok(result.outputCode.includes('async client('))
    assert.ok(result.outputCode.includes("const { formatDate } = await import('./utils.js')"))

    const postValidation = validateComponentSource(result.outputCode, 'date-comp.html')
    const postE301s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E301')
    assert.strictEqual(postE301s.length, 0)
  })

  test('CORALITE-E301: handles default import, namespace import, and mixed imports rewriting', () => {
    const input = `<template>
  <div>Chart</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import Chart from 'chart.js'
  import * as d3 from 'd3'

  export default defineComponent({
    client() {
      const c = Chart
      const d = d3
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'chart.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(!result.outputCode.includes("import Chart from 'chart.js'"))
    assert.ok(!result.outputCode.includes("import * as d3 from 'd3'"))
    assert.ok(result.outputCode.includes("const { default: Chart } = await import('chart.js')"))
    assert.ok(result.outputCode.includes("const d3 = await import('d3')"))
  })

  test('CORALITE-E301: preserves top-level static import when shared with server() or getters', () => {
    const input = `<template>
  <div>Shared</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'

  export default defineComponent({
    getters: {
      formatted({ state }) {
        return formatDate(state.date)
      }
    },
    client() {
      const d = formatDate(new Date())
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'shared-import.html' })
    assert.strictEqual(result.modified, true)
    // Top-level import MUST be preserved because it is used in getters
    assert.ok(result.outputCode.includes("import { formatDate } from './utils.js'"))
    // Dynamic import must also be injected in client()
    assert.ok(result.outputCode.includes('async client('))
    assert.ok(result.outputCode.includes("const { formatDate } = await import('./utils.js')"))
  })

  test('Template boundary enforcement: ref injection and inline event removal strictly modify inside <template>', () => {
    const input = `<template>
  <button id="action-btn" onclick="doSomething()">Click Me</button>
</template>

<script>
  // Comment with onclick="ignoreMe()" outside template
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('action-btn')
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'boundary.html' })
    assert.strictEqual(result.modified, true)
    // Ref added inside template
    assert.ok(result.outputCode.includes('<button ref="action-btn" id="action-btn">Click Me</button>'))
    // Inline event removed from template button
    assert.ok(!result.outputCode.includes('onclick="doSomething()"'))
    // Code outside template remains untouched
    assert.ok(result.outputCode.includes('// Comment with onclick="ignoreMe()" outside template'))
  })

  test('CORALITE-E202: injects ref attribute into single matching candidate element', () => {
    const input = `<template>
  <button id="submit">Submit</button>
  <div>Text</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('submit-btn')
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'submit.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('<button ref="submit-btn" id="submit">Submit</button>'))

    const postValidation = validateComponentSource(result.outputCode, 'submit.html')
    const postE202s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E202')
    assert.strictEqual(postE202s.length, 0)
  })

  test('CORALITE-E202: skips ref injection when element already has a ref attribute', () => {
    const input = `<template>
  <button ref="existing-ref" id="action-btn">Action</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('action-btn')
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'existing-ref.html' })
    assert.ok(!result.outputCode.includes('ref="action-btn"'))
    assert.ok(result.outputCode.includes('ref="existing-ref"'))
  })

  test('CORALITE-E202: skips ref injection when candidate count !== 1 (ambiguous)', () => {
    const input = `<template>
  <button>One</button>
  <button>Two</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('submit-btn')
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'multi-btn.html' })
    // No single candidate -> ref injection skipped
    assert.ok(!result.outputCode.includes('ref="submit-btn"'))
  })

  test('CORALITE-E102: strips default property when required: true is set', () => {
    const input = `<template>
  <div>Title</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, required: true, default: 'Untitled' }
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'title.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('required: true'))
    assert.ok(!result.outputCode.includes("default: 'Untitled'"))

    const postValidation = validateComponentSource(result.outputCode, 'title.html')
    const postE102s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E102')
    assert.strictEqual(postE102s.length, 0)
  })

  test('CORALITE-E203: removes inline event listener attribute from template', () => {
    const input = `<template>
  <button onclick="handleClick()">Click</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'event.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(!result.outputCode.includes('onclick="handleClick()"'))
  })

  test('Multi-fix processing: resolves E201, E301, E202, and E102 in a single invocation', () => {
    const input = `<template>
  <button id="save">Save</button>
  <div>{{ user.profile.name }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'

  export default defineComponent({
    attributes: {
      title: { type: String, required: true, default: 'Default' }
    },
    client({ refs }) {
      const btn = refs('save-btn')
      const d = formatDate(new Date())
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'multi.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('ref="save-btn"'))
    assert.ok(result.outputCode.includes('{{ userProfileName }}'))
    assert.ok(!result.outputCode.includes("default: 'Default'"))
    assert.ok(!result.outputCode.includes("import { formatDate } from './utils.js'"))
    assert.ok(result.outputCode.includes("const { formatDate } = await import('./utils.js')"))
    assert.strictEqual(result.fixesApplied.length, 4)
  })

  test('CORALITE-W204: unwraps redundant top-level ref existence guards', () => {
    const input = `<template>
  <button ref="submit-btn">Submit</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs, signal }) {
      const btn = refs('submit-btn')
      if (btn) {
        btn.addEventListener('click', () => {}, { signal })
      }
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'w204-fix.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(!result.outputCode.includes('if (btn)'))
    assert.ok(result.outputCode.includes("btn.addEventListener('click', () => {}, { signal })"))

    const postValidation = validateComponentSource(result.outputCode, 'w204-fix.html')
    const postW204s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-W204')
    assert.strictEqual(postW204s.length, 0)
  })

  test('CORALITE-E105: rewrites context.attributes to context.state and destructured { attributes } to { state }', () => {
    const input = `<template>
  <div>Lang</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    async server(context) {
      const l = context.attributes.lang
      return { l }
    },
    async client({ attributes }) {
      console.log(attributes)
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'test-e105-fix.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('context.state.lang'))
    assert.ok(result.outputCode.includes('client({ state })'))

    const postValidation = validateComponentSource(result.outputCode, 'test-e105-fix.html')
    const postE105s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.strictEqual(postE105s.length, 0)
  })

  test('CORALITE-W204: unwraps ref guard in HTML components with leading template lines', () => {
    const templateLines = Array.from({ length: 40 }, (_, i) => `  <div>Line ${i + 1}</div>`).join('\n')
    const input = `<template>
${templateLines}
  <button ref="submit-btn">Submit</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs, signal }) {
      const btn = refs('submit-btn')
      if (btn) {
        btn.addEventListener('click', () => {}, { signal })
      }
    }
  })
</script>`

    const result = applyComponentFixes(input, null, { filePath: 'w204-html-offset.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(!result.outputCode.includes('if (btn)'))
    assert.ok(result.outputCode.includes("btn.addEventListener('click', () => {}, { signal })"))
  })

  test('CORALITE-E201: primary path uses diag.fix.expr directly without parsing message', () => {
    const input = `<template>
  <div>{{ val }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>`

    const precomputedDiagnostics = [{
      code: 'CORALITE-E201',
      severity: 'error',
      message: 'Unparsed fallback diagnostic message format',
      fix: {
        action: 'lift_to_getter',
        expr: 'val',
        description: "Lift expression to getter 'valGetter'",
        replacement: '{{ valGetter }}',
        getter: {
          name: 'valGetter',
          code: 'valGetter: ({ state }) => state.val'
        }
      }
    }]

    const result = applyComponentFixes(input, precomputedDiagnostics, { filePath: 'primary-path.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('{{ valGetter }}'))
    assert.ok(result.outputCode.includes('valGetter: ({ state }) => state.val'))
  })

  test('CORALITE-E201: fallback path extracts inline expression from diag.message when diag.fix.expr is absent', () => {
    const input = `<template>
  <div>{{ count + 1 }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>`

    const precomputedDiagnostics = [{
      code: 'CORALITE-E201',
      severity: 'error',
      message: "Inline expression '{{ count + 1 }}' in template must be lifted to a derived getter.",
      fix: {
        action: 'lift_to_getter',
        description: "Lift expression to getter 'countPlusOne'",
        replacement: '{{ countPlusOne }}',
        getter: {
          name: 'countPlusOne',
          code: 'countPlusOne: ({ state }) => (state.count + 1)'
        }
      }
    }]

    const result = applyComponentFixes(input, precomputedDiagnostics, { filePath: 'fallback-path.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('{{ countPlusOne }}'))
    assert.ok(result.outputCode.includes('countPlusOne: ({ state }) => (state.count + 1)'))
  })

  test('CORALITE-E201: whitespace-only mustache expression {{ }} returns null and skips fix', () => {
    const input = `<template>
  <div>{{   }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>`

    const precomputedDiagnostics = [{
      code: 'CORALITE-E201',
      severity: 'error',
      message: "Inline expression '{{   }}' in template must be lifted to a derived getter.",
      fix: {
        action: 'lift_to_getter',
        description: "Lift expression to getter 'derived'",
        replacement: '{{ derived }}',
        getter: {
          name: 'derived',
          code: 'derived: ({ state }) => state.derived'
        }
      }
    }]

    const result = applyComponentFixes(input, precomputedDiagnostics, { filePath: 'whitespace-mustache.html' })
    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.fixesApplied.length, 0)
    assert.ok(result.outputCode.includes('{{   }}'))
  })

  test('CORALITE-E201: ReDoS canary executes in under 5ms with 100,000+ whitespace characters', () => {
    const spaces = ' '.repeat(100000)
    const adversarialMessage = `Inline expression '{{${spaces}foo.bar${spaces}}}' in template must be lifted.`
    const input = `<template>
  <div>{{ foo.bar }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>`

    const precomputedDiagnostics = [{
      code: 'CORALITE-E201',
      severity: 'error',
      message: adversarialMessage,
      fix: {
        action: 'lift_to_getter',
        description: "Lift expression to getter 'fooBar'",
        replacement: '{{ fooBar }}',
        getter: {
          name: 'fooBar',
          code: 'fooBar: ({ state }) => state.foo?.bar'
        }
      }
    }]

    const start = performance.now()
    const result = applyComponentFixes(input, precomputedDiagnostics, { filePath: 'canary.html' })
    const duration = performance.now() - start

    assert.ok(duration < 5, `Execution took ${duration.toFixed(2)}ms (expected < 5ms)`)
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('{{ fooBar }}'))
  })

  test('dryRun support: generates colorized diff without throwing', () => {
    const oldCode = '<div>Old</div>'
    const newCode = '<div>New</div>'

    const diff = generateColorizedDiff(oldCode, newCode, 'test.html')
    assert.ok(diff.includes('[DRY-RUN PREVIEW] test.html'))
    assert.ok(diff.includes('- <div>Old</div>'))
    assert.ok(diff.includes('+ <div>New</div>'))
  })

  test('extractTemplateBlock: handles case-insensitivity (<TEMPLATE>, <Template>)', () => {
    const uppercaseInput = `<TEMPLATE>
  <button id="action">Upper</button>
</TEMPLATE>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({ client({ refs }) { const b = refs('action-btn') } })
</script>`

    const result = applyComponentFixes(uppercaseInput, null, { filePath: 'uppercase.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('<button ref="action-btn" id="action">Upper</button>'))
  })

  test('extractTemplateBlock: preserves byte offsets with length-expanding Unicode characters (e.g. İ)', () => {
    const unicodeInput = `// Special comment with İ (U+0130 expands to i\\u0307 in lowerCase)
<template>
  <button id="submit">Submit</button>
</template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({ client({ refs }) { const b = refs('submit-btn') } })
</script>`

    const result = applyComponentFixes(unicodeInput, null, { filePath: 'unicode.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('<button ref="submit-btn" id="submit">Submit</button>'))
    assert.ok(result.outputCode.startsWith('// Special comment with İ'))
  })

  test('extractTemplateBlock: ignores custom element tags like <template-item>', () => {
    const customTagInput = `<template-item>Not a template block</template-item>
<template>
  <button id="valid">Valid</button>
</template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({ client({ refs }) { const b = refs('valid-btn') } })
</script>`

    const result = applyComponentFixes(customTagInput, null, { filePath: 'custom-tag.html' })
    assert.strictEqual(result.modified, true)
    assert.ok(result.outputCode.includes('<template-item>Not a template block</template-item>'))
    assert.ok(result.outputCode.includes('<button ref="valid-btn" id="valid">Valid</button>'))
  })

  test('ReDoS canary: processes 20,000+ unclosed <template tags in under 2000ms', () => {
    const maliciousCode = '<template '.repeat(20000) + '<div>Content</div>'
    const precomputedDiagnostics = [{
      code: 'CORALITE-E202',
      severity: 'error',
      message: 'Missing ref "action-btn" for element <button>',
      fix: {
        action: 'inject_ref',
        description: 'Add ref="action-btn" to matching <button> element'
      }
    }]

    const start = performance.now()
    const result = applyComponentFixes(maliciousCode, precomputedDiagnostics, { filePath: 'redos-canary.html' })
    const duration = performance.now() - start

    assert.ok(duration < 2000, `Execution took ${duration.toFixed(2)}ms (expected < 2000ms)`)
    assert.strictEqual(result.modified, false)
  })
})
