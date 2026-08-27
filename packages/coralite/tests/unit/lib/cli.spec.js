import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cliBin = join(fileURLToPath(import.meta.url), '../../../../bin/coralite.js')
const tmpDir = join(fileURLToPath(import.meta.url), '../../../../.tmp-cli-test')

function runCli (args, options = {}) {
  return execSync(`node --conditions=development "${cliBin}" ${args}`, options)
}

describe('CLI Integration Tests (coralite.js)', () => {
  beforeEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  describe('coralite init-agent', () => {
    test('scaffolds AGENTS.md in project root', () => {
      runCli('init-agent', { cwd: tmpDir })
      const agentsPath = join(tmpDir, 'AGENTS.md')
      assert.strictEqual(existsSync(agentsPath), true)
      const content = readFileSync(agentsPath, 'utf8')
      assert.match(content, /Dumb Template Invariant/)
      assert.match(content, /Serialization Boundary/)
      assert.match(content, /Attribute Primitives/)
      assert.match(content, /Two-Phase Plugin Context/)
    })

    test('supports --cursor and --claude flags', () => {
      runCli('init-agent --cursor --claude', { cwd: tmpDir })
      assert.strictEqual(existsSync(join(tmpDir, 'AGENTS.md')), true)
      assert.strictEqual(existsSync(join(tmpDir, '.cursorrules')), true)
      assert.strictEqual(existsSync(join(tmpDir, '.cursor/rules/coralite.mdc')), true)
      assert.strictEqual(existsSync(join(tmpDir, 'CLAUDE.md')), true)
    })
  })

  describe('coralite check', () => {
    test('runs unified check and returns json format', () => {
      const compDir = join(tmpDir, 'components')
      mkdirSync(compDir, { recursive: true })
      writeFileSync(join(compDir, 'test-card.html'), `
<template id="test-card">
  <div>{{ title }}</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    getters: {
      title: () => 'Hello World'
    }
  })
</script>
`)

      const output = runCli('check -c components --format json', { cwd: tmpDir }).toString()
      const json = JSON.parse(output)
      assert.ok(json.components)
      assert.ok(json.summary)
      assert.strictEqual(json.summary.totalFiles, 1)
      assert.strictEqual(json.summary.validFiles, 1)
      assert.strictEqual(json.summary.errorCount, 0)
    })

    test('exits with code 0 when only warnings exist in standard mode, and code 1 in --strict mode', () => {
      const pageDir = join(tmpDir, 'pages')
      mkdirSync(pageDir, { recursive: true })
      writeFileSync(join(pageDir, 'index.html'), `
<!DOCTYPE html>
<html>
  <body>
    <unknown-element></unknown-element>
  </body>
</html>
`)

      // Standard mode: exits with code 0 even with warnings
      const output = runCli('check --pages pages', { cwd: tmpDir }).toString()
      assert.match(output, /1 warning\(s\)/)

      // Strict mode: exits with code 1 when warnings exist
      assert.throws(() => {
        runCli('check --pages pages --strict', { cwd: tmpDir, stdio: 'pipe' })
      })
    })

    test('exits with code 1 when errors exist in unified check', () => {
      const compDir = join(tmpDir, 'components')
      mkdirSync(compDir, { recursive: true })
      writeFileSync(join(compDir, 'bad-comp.html'), `
<template id="bad-comp">
  <div>{{ title + ' invalid' }}</div>
</template>
`)

      assert.throws(() => {
        runCli('check -c components', { cwd: tmpDir, stdio: 'pipe' })
      })
    })
  })

  describe('coralite fix', () => {
    test('supports --dry-run without modifying files', () => {
      const compDir = join(tmpDir, 'components')
      mkdirSync(compDir, { recursive: true })
      const compPath = join(compDir, 'fixable-comp.html')
      const initialCode = `
<template id="fixable-comp">
  <div>{{ count + 1 }}</div>
</template>
`
      writeFileSync(compPath, initialCode)

      const output = runCli('fix -c components --dry-run', { cwd: tmpDir }).toString()
      assert.match(output, /Dry-run complete/)
      const codeAfter = readFileSync(compPath, 'utf8')
      assert.strictEqual(codeAfter, initialCode)
    })

    test('applies fixes to disk when run without --dry-run', () => {
      const plugDir = join(tmpDir, 'plugins')
      mkdirSync(plugDir, { recursive: true })
      const plugPath = join(plugDir, 'my-plugin.js')
      const initialCode = `
export default {
  name: 'my-plugin',
  server: {
    context: (ctx) => ({ foo: 'bar' })
  }
}
`
      writeFileSync(plugPath, initialCode)

      runCli('fix -p plugins', { cwd: tmpDir, stdio: 'pipe' })
      const fixedCode = readFileSync(plugPath, 'utf8')
      assert.match(fixedCode, /definePlugin/)
      assert.match(fixedCode, /\(ctx\) => \(instanceContext\)/)
    })
  })

  describe('coralite validate-pages', () => {
    test('validates pages directory and outputs console report', () => {
      const pageDir = join(tmpDir, 'pages')
      mkdirSync(pageDir, { recursive: true })
      writeFileSync(join(pageDir, 'index.html'), `
<!DOCTYPE html>
<html>
  <body>
    <div>Valid Page</div>
  </body>
</html>
`)

      const output = runCli('validate-pages --pages pages', { cwd: tmpDir }).toString()
      assert.match(output, /📄 Coralite Page Validation Report/)
      assert.match(output, /✔ VALID/)
      assert.match(output, /Summary: 1 page\(s\) validated/)
    })

    test('supports --format json', () => {
      const pageDir = join(tmpDir, 'pages')
      mkdirSync(pageDir, { recursive: true })
      writeFileSync(join(pageDir, 'index.html'), `
<!DOCTYPE html>
<html>
  <body>
    <div>Valid Page</div>
  </body>
</html>
`)

      const output = runCli('validate-pages --pages pages --format json', { cwd: tmpDir }).toString()
      const json = JSON.parse(output)
      assert.ok(json.pages)
      assert.ok(json.summary)
      assert.strictEqual(json.summary.totalPages, 1)
      assert.strictEqual(json.summary.validPages, 1)
    })
  })

  describe('validate-plugins --fix and --dry-run', () => {
    test('validate-plugins --fix applies AST plugin fixes', () => {
      const plugDir = join(tmpDir, 'plugins')
      mkdirSync(plugDir, { recursive: true })
      const plugPath = join(plugDir, 'test-plugin.js')
      writeFileSync(plugPath, `
export default {
  name: 'test-plugin',
  server: {
    context: (ctx) => ({ val: 1 })
  }
}
`)

      runCli('validate-plugins -p plugins --fix', { cwd: tmpDir, stdio: 'pipe' })
      const fixedCode = readFileSync(plugPath, 'utf8')
      assert.match(fixedCode, /definePlugin/)
    })
  })
})
