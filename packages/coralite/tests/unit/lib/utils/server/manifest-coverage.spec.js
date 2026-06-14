import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkFileChange, initHasher } from '../../../../../lib/utils/server/manifest.js'
import { createTestProject } from '../../../utils/project.js'

describe('manifest.js Coverage Gaps', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
    await initHasher()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should handle mtime change but same hash', async () => {
    const file = join(project.testDir, 'test.txt')
    await writeFile(file, 'hello')

    const first = await checkFileChange(file)
    assert.strictEqual(first.changed, true)

    // Update mtime but keep content same
    const { utimes } = await import('node:fs/promises')
    const future = new Date(Date.now() + 2000)
    await utimes(file, future, future)

    const second = await checkFileChange(file, first.metadata)
    assert.strictEqual(second.changed, false)
    assert.notStrictEqual(second.metadata.mtime, first.metadata.mtime)
    assert.strictEqual(second.metadata.hash, first.metadata.hash)
  })

  it('should handle concurrent initHasher calls', async () => {
    // already initialized in beforeEach, but let's call it again
    await Promise.all([initHasher(), initHasher()])
  })
})
