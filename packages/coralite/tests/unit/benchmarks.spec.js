import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildData, updateData, swapRows } from '../../benchmarks/utils/data-generator.js'
import { getMemoryUsage, triggerGC } from '../../benchmarks/utils/memory.js'
import { generateMarkdownTable, writeJSONResults } from '../../benchmarks/utils/reporter.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

describe('Benchmark Suite Utilities Smoke Tests', () => {
  describe('data-generator.js', () => {
    it('buildData generates deterministic data structure', () => {
      const data = buildData(10, 42)
      assert.strictEqual(data.length, 10)
      assert.ok(typeof data[0].id === 'number')
      assert.ok(typeof data[0].label === 'string')
      assert.ok(data[0].label.length > 0)
    })

    it('updateData updates every Nth item correctly', () => {
      const data = buildData(10, 42)
      const updated = updateData(data, 5)
      assert.strictEqual(updated.length, 10)
      assert.ok(updated[0].label.endsWith('!!!'))
      assert.strictEqual(updated[1].label, data[1].label)
      assert.ok(updated[5].label.endsWith('!!!'))
    })

    it('swapRows correctly swaps elements at specified indices', () => {
      const data = buildData(5, 42)
      const swapped = swapRows(data, 1, 3)
      assert.strictEqual(swapped[1].id, data[3].id)
      assert.strictEqual(swapped[3].id, data[1].id)
      assert.strictEqual(swapped[0].id, data[0].id)
    })
  })

  describe('memory.js', () => {
    it('getMemoryUsage returns valid numeric MB fields', () => {
      const mem = getMemoryUsage()
      assert.ok(typeof mem.rssMB === 'number')
      assert.ok(typeof mem.heapTotalMB === 'number')
      assert.ok(typeof mem.heapUsedMB === 'number')
      assert.ok(typeof mem.externalMB === 'number')
      assert.ok(mem.heapUsedMB > 0)
    })

    it('triggerGC runs without throwing', () => {
      assert.doesNotThrow(() => {
        triggerGC()
      })
    })
  })

  describe('reporter.js', () => {
    it('generateMarkdownTable produces formatted table string for arrays and objects', () => {
      const arrayData = [
        { benchmark: 'Test Bench', opsPerSec: 1000, avgLatencyNs: 5.2, speedup: 1.0 }
      ]
      const arrayMd = generateMarkdownTable('Internal Benchmarks', arrayData)
      assert.ok(arrayMd.includes('### Internal Benchmarks'))
      assert.ok(arrayMd.includes('Ops/Sec'))
      assert.ok(arrayMd.includes('Test Bench'))

      const objectData = {
        coralite: { create1k: 12.5, replace1k: 15.0 },
        react: { create1k: 20.1, replace1k: 22.4 }
      }
      const objectMd = generateMarkdownTable('DOM Reactivity', objectData)
      assert.ok(objectMd.includes('### DOM Reactivity'))
      assert.ok(objectMd.includes('Framework'))
      assert.ok(objectMd.includes('coralite'))
    })

    it('writeJSONResults writes structured JSON file', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-test-'))
      const outFile = path.join(tmpDir, 'results.json')
      const payload = { timestamp: '2025-01-01', suites: { test: {} } }

      try {
        writeJSONResults(payload, outFile)
        assert.ok(fs.existsSync(outFile))
        const readData = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
        assert.strictEqual(readData.timestamp, '2025-01-01')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('runner.js CLI suite validation', () => {
    it('exits with status 1 and prints error when invalid suite is provided', async () => {
      const runnerPath = path.resolve(import.meta.dirname, '../../benchmarks/runner.js')
      await assert.rejects(
        execFileAsync(process.execPath, ['--experimental-vm-modules', runnerPath, '--suite=invalid-suite-name']),
        (err) => {
          assert.strictEqual(err.code, 1)
          assert.ok(err.stderr.includes('Unknown suite "invalid-suite-name"'))
          return true
        }
      )
    })
  })
})
