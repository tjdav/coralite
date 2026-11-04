import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { typeCheck } from '../../../../lib/server/type-checker/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../../../fixtures/type-checker')

describe('typeCheck', () => {
  it('returns zero diagnostics for a component with correct types', async () => {
    const file = path.join(fixturesDir, 'typed-ok.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('reports a diagnostic with correct file, line, column, severity, and message for type error', async () => {
    const file = path.join(fixturesDir, 'typed-error.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.strictEqual(result.diagnostics.length, 1)

    const diag = result.diagnostics[0]
    assert.strictEqual(diag.file, file)
    assert.strictEqual(diag.line, 8)
    assert.strictEqual(diag.column, 7)
    assert.strictEqual(diag.severity, 'error')
    assert.strictEqual(diag.code, 2322)
    assert.ok(diag.message.includes("Type 'string' is not assignable to type 'number'"))
  })

  it('reports a diagnostic when a component imports a non-existent export', async () => {
    const file = path.join(fixturesDir, 'typed-import-error.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.ok(result.diagnostics.length >= 1)

    const diag = result.diagnostics.find(d => d.code === 2614 || d.code === 2305)
    assert.ok(diag, 'Expected diagnostic for missing export')
    assert.strictEqual(diag.file, file)
    assert.strictEqual(diag.severity, 'error')
  })

  it('returns zero diagnostics and does not crash for a component with no script block', async () => {
    const file = path.join(fixturesDir, 'no-script.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('reports a diagnostic for a page file with a type error', async () => {
    const file = path.join(fixturesDir, 'page-with-error.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.strictEqual(result.diagnostics.length, 1)

    const diag = result.diagnostics[0]
    assert.strictEqual(diag.file, file)
    assert.strictEqual(diag.line, 9)
    assert.strictEqual(diag.column, 9)
    assert.strictEqual(diag.severity, 'error')
    assert.strictEqual(diag.code, 2322)
    assert.ok(diag.message.includes("Type 'number' is not assignable to type 'boolean'"))
  })

  it('returns skipped result when typescript cannot be imported', async () => {
    const file = path.join(fixturesDir, 'typed-error.html')
    const result = await typeCheck([file], { cwd: '/nonexistent-directory-for-testing' })

    assert.strictEqual(result.skipped, true)
    assert.strictEqual(result.reason, 'typescript not installed')
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('returns zero diagnostics for an empty files array', async () => {
    const result = await typeCheck([])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('handles multiple files in one call and produces diagnostics for each file with errors', async () => {
    const okFile = path.join(fixturesDir, 'typed-ok.html')
    const errorFile1 = path.join(fixturesDir, 'typed-error.html')
    const errorFile2 = path.join(fixturesDir, 'page-with-error.html')

    const result = await typeCheck([okFile, errorFile1, errorFile2])

    assert.strictEqual(result.skipped, false)
    assert.strictEqual(result.diagnostics.length, 2)

    const filesInDiagnostics = result.diagnostics.map(d => d.file)
    assert.ok(filesInDiagnostics.includes(errorFile1))
    assert.ok(filesInDiagnostics.includes(errorFile2))
    assert.ok(!filesInDiagnostics.includes(okFile))
  })

  it('returns zero diagnostics for a component with remote URL imports in client()', async () => {
    const file = path.join(fixturesDir, 'url-import-ok.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('returns zero diagnostics for a page accessing Node globals (process, Buffer) in paths() and server()', async () => {
    const file = path.join(fixturesDir, 'node-globals-ok.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('returns zero diagnostics for Node globals when tsconfig specifies types array omitting node', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coralite-types-test-'))
    const tsconfigPath = path.join(tmpDir, 'tsconfig.json')
    fs.writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        types: []
      }
    }))

    const file = path.join(fixturesDir, 'node-globals-ok.html')
    try {
      const result = await typeCheck([file], { tsconfig: tsconfigPath })
      assert.strictEqual(result.skipped, false)
      assert.deepStrictEqual(result.diagnostics, [])
    } finally {
      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('suppresses TS2580 diagnostics for Node globals when typeRoots is empty', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coralite-typeroots-test-'))
    const tsconfigPath = path.join(tmpDir, 'tsconfig.json')
    fs.writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        typeRoots: []
      }
    }))

    const file = path.join(fixturesDir, 'node-globals-ok.html')
    try {
      const result = await typeCheck([file], { tsconfig: tsconfigPath })
      assert.strictEqual(result.skipped, false)
      assert.deepStrictEqual(result.diagnostics, [])
    } finally {
      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('returns zero diagnostics for a component accessing Node globals (process, Buffer) in server()', async () => {
    const file = path.join(fixturesDir, 'node-globals-component-ok.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.deepStrictEqual(result.diagnostics, [])
  })

  it('still reports a Node global referenced inside client() when Node types are unavailable', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coralite-client-leak-test-'))
    const tsconfigPath = path.join(tmpDir, 'tsconfig.json')
    fs.writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        typeRoots: []
      }
    }))

    const file = path.join(fixturesDir, 'node-globals-client-leak.html')
    try {
      const result = await typeCheck([file], { tsconfig: tsconfigPath })
      assert.strictEqual(result.skipped, false)
      assert.strictEqual(result.diagnostics.length, 1)

      const diag = result.diagnostics[0]
      assert.strictEqual(diag.file, file)
      assert.strictEqual(diag.line, 18)
      assert.strictEqual(diag.severity, 'error')
      assert.ok(diag.code === 2580 || diag.code === 2304)
      assert.ok(diag.message.includes("Cannot find name 'process'"))
    } finally {
      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('still reports unknown non-Node identifiers (plain TS2304) outside client ranges', async () => {
    const file = path.join(fixturesDir, 'node-globals-negative.html')
    const result = await typeCheck([file])

    assert.strictEqual(result.skipped, false)
    assert.strictEqual(result.diagnostics.length, 1)

    const diag = result.diagnostics[0]
    assert.strictEqual(diag.file, file)
    assert.strictEqual(diag.severity, 'error')
    assert.strictEqual(diag.code, 2304)
    assert.ok(diag.message.includes("Cannot find name 'foobro'"))
  })
})
