import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { createCLIProject } from '../utils/project.js'

describe('check and fix commands', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    if (project) {
      await project.cleanup()
    }
  })

  it('1. check validates clean project and passes with 0 exit code', async () => {
    await project.writeComponent('card-element.html', `
<template id="card-element">
  <div class="card">
    <h2>{{ title }}</h2>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Default Title' }
    }
  })
</script>
`)

    await project.writePage('index.html', `
<!DOCTYPE html>
<html>
<body>
  <card-element title="Hello World"></card-element>
</body>
</html>
`)

    const res = await project.runCheck()
    assert.strictEqual(res.exitCode, 0)
    assert.strictEqual(res.result.hasFailures, false)
    assert.strictEqual(res.result.summary.errorCount, 0)
    assert.ok(res.stdout.includes('Coralite Workspace Check Report'))
  })

  it('2. check detects invalid component expressions and invalid page attributes', async () => {
    // Expression in template: CORALITE-E201
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn">
  <button>{{ count + 1 }}</button>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      count: { type: Number, default: 0 }
    }
  })
</script>
`)

    const res = await project.runCheck()
    assert.strictEqual(res.exitCode, 1)
    assert.strictEqual(res.result.hasFailures, true)
    assert.ok(res.result.summary.errorCount > 0)
  })

  it('3. check --format json returns valid JSON output matching summary schema', async () => {
    await project.writeComponent('card-element.html', `
<template id="card-element">
  <div>{{ title }}</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Card' }
    }
  })
</script>
`)

    const res = await project.runCheck(['--format', 'json'])
    assert.strictEqual(res.exitCode, 0)
    const json = JSON.parse(res.stdout)
    assert.ok(json.summary)
    assert.strictEqual(typeof json.summary.totalFiles, 'number')
    assert.strictEqual(typeof json.summary.errorCount, 'number')
  })

  it('4. check --strict exits non-zero when warnings exist', async () => {
    // Define an unused attribute to trigger warning
    await project.writeComponent('warn-comp.html', `
<template id="warn-comp">
  <div>Hello</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      unusedProp: { type: String, default: 'unused' }
    }
  })
</script>
`)

    const resNormal = await project.runCheck()
    assert.strictEqual(resNormal.exitCode, 0) // Normal check passes with 0 for warnings

    const resStrict = await project.runCheck(['--strict'])
    assert.strictEqual(resStrict.exitCode, 1) // Strict check fails with 1
  })

  it('5. fix --dry-run prints unified diffs without modifying files on disk', async () => {
    const originalCode = `
<template id="counter-btn">
  <button>{{ count + 1 }}</button>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      count: { type: Number, default: 0 }
    }
  })
</script>
`
    const filePath = await project.writeComponent('counter-btn.html', originalCode)

    const res = await project.runFix(['--dry-run'])
    assert.strictEqual(res.exitCode, 0)
    assert.ok(res.stdout.includes('Dry-run complete'))

    const contentAfterDryRun = await readFile(filePath, 'utf8')
    assert.strictEqual(contentAfterDryRun, originalCode)
  })

  it('6. fix updates disk files and repairs component template expressions', async () => {
    const originalCode = `
<template id="counter-btn">
  <button>{{ count + 1 }}</button>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      count: { type: Number, default: 0 }
    }
  })
</script>
`
    const filePath = await project.writeComponent('counter-btn.html', originalCode)

    const res = await project.runFix()
    const contentAfterFix = await readFile(filePath, 'utf8')
    assert.notStrictEqual(contentAfterFix, originalCode)
    assert.ok(contentAfterFix.includes('countPlus1') || contentAfterFix.includes('getters'))
  })

  it('7. configuration fallback resolves components, pages, and plugins from coralite.config.js', async () => {
    await project.writeComponent('my-item.html', `
<template id="my-item">
  <div>Item</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`)

    const res = await project.runCheck()
    assert.strictEqual(res.exitCode, 0)
    assert.strictEqual(res.result.summary.totalFiles, 1)
  })

  it('8. check handles plugins array in coralite.config.js without throwing ERR_INVALID_ARG_TYPE', async () => {
    await project.writeConfig(`
      export default {
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        plugins: [
          { name: 'inline-test-plugin' }
        ]
      }
    `)

    await project.writeComponent('my-item.html', `
<template id="my-item">
  <div>Item</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`)

    const res = await project.runCheck()
    assert.strictEqual(res.exitCode, 0)
    assert.strictEqual(res.result.hasFailures, false)
    assert.strictEqual(res.result.summary.errorCount, 0)
  })

  it('9. check and fix execute real CLI binary via child process against plugins array and missing folders', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const path = await import('node:path')
    const execFileAsync = promisify(execFile)

    const binPath = path.resolve(process.cwd(), 'bin/index.js')

    await project.writeConfig(`
      export default {
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        plugins: [
          { name: 'dummy-plugin' }
        ]
      }
    `)

    await project.writeComponent('card-element.html', `
<template id="card-element">
  <div>{{ title }}</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Card' }
    }
  })
</script>
`)

    // Run CLI check command via node child process
    const checkRes = await execFileAsync(process.execPath, [binPath, 'check'], {
      cwd: project.testDir
    })

    assert.ok(checkRes.stdout.includes('Coralite Workspace Check Report'))
    assert.ok(checkRes.stdout.includes('Summary: 1 file(s) validated'))

    // Run CLI fix command via node child process
    const fixRes = await execFileAsync(process.execPath, [binPath, 'fix'], {
      cwd: project.testDir
    })

    assert.ok(fixRes.stdout.includes('No fixable issues found') || fixRes.stdout.includes('Coralite Workspace Check Report'))
  })

  it('10. check --error-code CORALITE-E201 filters output and exits 1 when matching error exists', async () => {
    // Valid component
    await project.writeComponent('valid-card.html', `
<template id="valid-card"><div>{{ title }}</div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { title: { type: String, default: 'Card' } } })
</script>
`)
    // Component with CORALITE-E201
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['--error-code', 'CORALITE-E201'])
    assert.strictEqual(res.exitCode, 1)
    assert.strictEqual(res.result.hasFailures, true)
    // Valid component should be suppressed by default when filtering by error code
    assert.strictEqual(res.stdout.includes('valid-card.html'), false)
    assert.ok(res.stdout.includes('counter-btn.html'))
  })

  it('11. check --error-code CORALITE-E102 exits 0 when no matching issue exists for that code', async () => {
    // Project only has CORALITE-E201
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['--error-code', 'CORALITE-E102'])
    assert.strictEqual(res.exitCode, 0)
    assert.strictEqual(res.result.hasFailures, false)
    assert.ok(res.stdout.includes('No issues matching error code(s)'))
  })

  it('12. check -e E201 normalizes shorthand code to match CORALITE-E201', async () => {
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['-e', 'E201'])
    assert.strictEqual(res.exitCode, 1)
    assert.ok(res.stdout.includes('counter-btn.html'))
  })

  it('13. check --status failed / --only-failed suppresses valid components from report', async () => {
    await project.writeComponent('valid-card.html', `
<template id="valid-card"><div>{{ title }}</div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { title: { type: String, default: 'Card' } } })
</script>
`)
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['--only-failed'])
    assert.strictEqual(res.exitCode, 1)
    assert.strictEqual(res.stdout.includes('valid-card.html'), false)
    assert.ok(res.stdout.includes('counter-btn.html'))
  })

  it('14. check --status passed displays only valid components', async () => {
    await project.writeComponent('valid-card.html', `
<template id="valid-card"><div>{{ title }}</div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { title: { type: String, default: 'Card' } } })
</script>
`)
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['--status', 'passed'])
    assert.strictEqual(res.stdout.includes('valid-card.html'), true)
    assert.strictEqual(res.stdout.includes('counter-btn.html'), false)
  })

  it('15. check --format json --error-code CORALITE-E201 attaches filter metadata to root JSON', async () => {
    await project.writeComponent('counter-btn.html', `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`)

    const res = await project.runCheck(['--format', 'json', '-e', 'CORALITE-E201'])
    const json = JSON.parse(res.stdout)
    assert.ok(json.filter)
    assert.deepStrictEqual(json.filter.errorCodes, ['CORALITE-E201'])
    assert.strictEqual(json.filter.status, 'failed')
  })

  it('16. fix --error-code CORALITE-E201 targets only specified error code', async () => {
    const exprCode = `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`
    const compFile = await project.writeComponent('counter-btn.html', exprCode)

    const res = await project.runFix(['-e', 'CORALITE-E201'])
    assert.strictEqual(res.result.totalFixesCount, 1)

    const fixedContent = await readFile(compFile, 'utf8')
    assert.notStrictEqual(fixedContent, exprCode)
  })

  it('17. fix --dry-run --error-code CORALITE-E201 previews diffs for specified error code only', async () => {
    const exprCode = `
<template id="counter-btn"><button>{{ count + 1 }}</button></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({ attributes: { count: { type: Number, default: 0 } } })
</script>
`
    await project.writeComponent('counter-btn.html', exprCode)

    const res = await project.runFix(['--dry-run', '-e', 'E201'])
    assert.ok(res.stdout.includes('Dry-run complete'))
    assert.strictEqual(res.result.totalFixesCount, 1)
  })
})
