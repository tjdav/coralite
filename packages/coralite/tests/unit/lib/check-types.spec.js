import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const coraliteBin = path.resolve(__dirname, '../../../bin/coralite.js')
const fixturesDir = path.resolve(__dirname, '../../fixtures/check-types')

describe('coralite check type-checker integration', () => {
  it('coralite check (default) runs both AST and type-check passes', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', fixturesDir, '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code due to errors')
    } catch (err) {
      assert.notEqual(err.code, 0)
      const stdout = err.stdout || ''
      assert.match(stdout, /CORALITE-E203/)
      assert.match(stdout, /TS2339/)
    }
  })

  it('coralite check --no-types skips the type-check pass', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', path.join(fixturesDir, 'type-error.html'), '--no-types', '--no-interactive', '--pages=false', '--plugins=false'])
      // type-error.html has a TS error but valid AST, so with --no-types it passes
    } catch (err) {
      assert.fail(`Expected exit code 0 when --no-types skips type check, but got: ${err.message}`)
    }
  })

  it('coralite check --types-only skips the AST passes', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', path.join(fixturesDir, 'ast-error.html'), '--types-only', '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code due to TS error')
    } catch (err) {
      assert.notEqual(err.code, 0)
      const stdout = err.stdout || ''
      const json = JSON.parse(stdout)
      const comp = json.components?.components?.[0]
      assert.ok(comp)
      const astDiags = comp.diagnostics.filter(d => d.code.startsWith('CORALITE-'))
      const tsDiags = comp.diagnostics.filter(d => d.code.startsWith('TS'))
      assert.equal(astDiags.length, 0)
      assert.ok(tsDiags.length > 0)
    }
  })

  it('coralite check --no-types --types-only exits with code 1 and error message', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '--no-types', '--types-only', '--no-interactive'])
      assert.fail('Expected command to exit with code 1')
    } catch (err) {
      assert.equal(err.code, 1)
      assert.match(err.stderr || '', /mutually exclusive/)
    }
  })

  it('component with a type error produces diagnostic with TS#### code, filePath, line, column, and source: type-checker', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', path.join(fixturesDir, 'type-error.html'), '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code')
    } catch (err) {
      const json = JSON.parse(err.stdout)
      const comp = json.components?.components?.[0]
      assert.ok(comp)
      assert.equal(comp.valid, false)
      const tsDiag = comp.diagnostics.find(d => d.code === 'TS2322')
      assert.ok(tsDiag)
      assert.equal(tsDiag.source, 'type-checker')
      assert.equal(typeof tsDiag.line, 'number')
      assert.equal(typeof tsDiag.column, 'number')
      assert.ok(tsDiag.filePath.includes('type-error.html'))
    }
  })

  it('component with AST error and type error produces both diagnostics in merged output', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', path.join(fixturesDir, 'ast-error.html'), '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code')
    } catch (err) {
      const json = JSON.parse(err.stdout)
      const comp = json.components?.components?.[0]
      assert.ok(comp)
      const codes = comp.diagnostics.map(d => d.code)
      assert.ok(codes.includes('CORALITE-E203'))
      assert.ok(codes.includes('TS2339'))
    }
  })

  it('--error-code TS2322 filters to type errors only', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', fixturesDir, '-e', 'TS2322', '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code')
    } catch (err) {
      const json = JSON.parse(err.stdout)
      for (const comp of json.components?.components || []) {
        for (const d of comp.diagnostics || []) {
          assert.equal(d.code, 'TS2322')
        }
      }
    }
  })

  it('--error-code E203 filters to AST errors only', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', fixturesDir, '-e', 'E203', '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code')
    } catch (err) {
      const json = JSON.parse(err.stdout)
      assert.ok(json.components?.components?.length > 0)
      for (const comp of json.components?.components || []) {
        for (const d of comp.diagnostics || []) {
          assert.equal(d.code, 'CORALITE-E203')
        }
      }
    }
  })

  it('--status failed includes files with type errors', async () => {
    try {
      await execFileAsync('node', ['--conditions=development', coraliteBin, 'check', '-c', fixturesDir, '--status', 'failed', '--format', 'json', '--no-interactive'])
      assert.fail('Expected command to exit with non-zero code')
    } catch (err) {
      const json = JSON.parse(err.stdout)
      const files = (json.components?.components || []).map(c => c.filePath)
      assert.ok(files.some(f => f.includes('type-error.html')))
      assert.ok(files.some(f => f.includes('ast-error.html')))
      assert.ok(!files.some(f => f.includes('valid.html')))
    }
  })
})
