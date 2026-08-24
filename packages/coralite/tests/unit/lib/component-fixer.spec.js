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
    assert.ok(result.outputCode.includes("userProfileName: (state) => state.user?.profile?.name ?? ''"))
    assert.strictEqual(result.fixesApplied.length, 1)
    assert.strictEqual(result.fixesApplied[0].code, 'CORALITE-E201')

    // Verify post-fix validation is clean for E201
    const postValidation = validateComponentSource(result.outputCode, 'user-card.html')
    const postE201s = postValidation.diagnostics.filter(d => d.code === 'CORALITE-E201')
    assert.strictEqual(postE201s.length, 0)
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
      formatted(state) {
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

  test('dryRun support: generates colorized diff without throwing', () => {
    const oldCode = '<div>Old</div>'
    const newCode = '<div>New</div>'

    const diff = generateColorizedDiff(oldCode, newCode, 'test.html')
    assert.ok(diff.includes('[DRY-RUN PREVIEW] test.html'))
    assert.ok(diff.includes('- <div>Old</div>'))
    assert.ok(diff.includes('+ <div>New</div>'))
  })
})
