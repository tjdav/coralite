import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cliBin = join(fileURLToPath(import.meta.url), '../../../../bin/coralite.js')
let tmpDir

function runCli (args, options = {}) {
  return execSync(`node --conditions=development "${cliBin}" ${args}`, options)
}

describe('CLI Integration Tests (coralite.js)', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'coralite-cli-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, {
      recursive: true,
      force: true
    })
  })

  describe('no subcommand', () => {
    test('prints help and exits with code 1 when invoked without subcommands', () => {
      assert.throws(() => {
        runCli('', {
          cwd: tmpDir,
          stdio: 'pipe'
        })
      }, (err) => {
        assert.strictEqual(err.status, 1)
        const stdout = err.stdout.toString()
        assert.match(stdout, /Usage: coralite/)
        assert.match(stdout, /Commands:/)
        return true
      })
    })
  })

  describe('coralite --help', () => {
    test('displays merged command list', () => {
      const output = runCli('--help', { cwd: tmpDir }).toString()
      assert.match(output, /dev/)
      assert.match(output, /test/)
      assert.match(output, /build/)
      assert.match(output, /check/)
      assert.match(output, /fix/)
      assert.match(output, /init-agent/)
      assert.match(output, /validate-components/)
      assert.match(output, /validate-pages/)
      assert.match(output, /validate-plugins/)
    })
  })

  describe('coralite dev --help and coralite test --help', () => {
    test('coralite dev --help displays dev options', () => {
      const output = runCli('dev --help', { cwd: tmpDir }).toString()
      assert.match(output, /Run development server/)
      assert.match(output, /-v, --verbose/)
      assert.match(output, /-c, --clean/)
      assert.match(output, /-a, --assets/)
    })

    test('coralite test --help displays test options', () => {
      const output = runCli('test --help', { cwd: tmpDir }).toString()
      assert.match(output, /Run testing server/)
      assert.match(output, /-v, --verbose/)
      assert.match(output, /-c, --clean/)
      assert.match(output, /-a, --assets/)
    })
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

      const output = runCli('check -c components --format json --no-types --no-interactive', { cwd: tmpDir }).toString()
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
      const output = runCli('check --pages pages --no-types --no-interactive', { cwd: tmpDir }).toString()
      assert.match(output, /1 warning\(s\)/)

      // Strict mode: exits with code 1 when warnings exist
      assert.throws(() => {
        runCli('check --pages pages --strict --no-types --no-interactive', {
          cwd: tmpDir,
          stdio: 'pipe'
        })
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
        runCli('check -c components --no-types --no-interactive', {
          cwd: tmpDir,
          stdio: 'pipe'
        })
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

      const output = runCli('fix -c components --dry-run --no-interactive', { cwd: tmpDir }).toString()
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

      runCli('fix -p plugins --no-interactive', {
        cwd: tmpDir,
        stdio: 'pipe'
      })
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

      const output = runCli('validate-pages --pages pages --no-interactive', { cwd: tmpDir }).toString()
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

      const output = runCli('validate-pages --pages pages --format json --no-interactive', { cwd: tmpDir }).toString()
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

      runCli('validate-plugins -p plugins --fix --no-interactive', {
        cwd: tmpDir,
        stdio: 'pipe'
      })
      const fixedCode = readFileSync(plugPath, 'utf8')
      assert.match(fixedCode, /definePlugin/)
    })
  })

  describe('coralite build (high-level)', () => {
    test('runs high-level build reading coralite.config.js', () => {
      const compDir = join(tmpDir, 'components')
      const pageDir = join(tmpDir, 'pages')
      const publicDir = join(tmpDir, 'public')
      const distDir = join(tmpDir, 'dist')
      mkdirSync(compDir, { recursive: true })
      mkdirSync(pageDir, { recursive: true })
      mkdirSync(publicDir, { recursive: true })
      writeFileSync(join(tmpDir, 'coralite.config.js'), `
export default {
  components: 'components',
  pages: 'pages',
  output: 'dist',
  public: 'public'
}
`)
      writeFileSync(join(compDir, 'hello-card.html'), `
<template id="hello-card">
  <div>Hello {{ title }}</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    getters: {
      title: () => 'World'
    }
  })
</script>
`)
      writeFileSync(join(pageDir, 'index.html'), '<!DOCTYPE html><html><body><hello-card></hello-card></body></html>')

      runCli('build', {
        cwd: tmpDir,
        stdio: 'pipe'
      })

      const outFile = join(distDir, 'index.html')
      assert.strictEqual(existsSync(outFile), true)
      const content = readFileSync(outFile, 'utf8')
      assert.ok(content.includes('>Hello <c-token>World</c-token><'))
    })

    test('errors when invoked with retired low-level flags -p or -o', () => {
      assert.throws(() => {
        runCli('build -c components -p pages -o dist', {
          cwd: tmpDir,
          stdio: 'pipe'
        })
      })
    })
  })

  describe('coralite validate-components', () => {
    test('validates a valid component and reports success', () => {
      const compDir = join(tmpDir, 'components')
      mkdirSync(compDir, { recursive: true })
      writeFileSync(join(compDir, 'ok-card.html'), `
<template id="ok-card">
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

      const output = runCli('validate-components -c components --no-interactive', { cwd: tmpDir }).toString()
      assert.match(output, /ok-card/)
      assert.match(output, /VALID|valid/i)
    })
  })
})
