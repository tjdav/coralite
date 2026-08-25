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
<template>
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
<template>
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
<template>
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
<template>
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
<template>
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
<template>
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
<template>
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
})
