import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hash, hashFile, checkFileChange, initHasher } from '../../../../../lib/utils/server/manifest.js'
import { createTestProject } from '../../../utils/project.js'

describe('Manifest Utils', () => {
  let project

  beforeEach(async () => {
    await initHasher()
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should generate xxHash64 hash', () => {
    const data = 'hello world'
    const h = hash(data)
    assert.strictEqual(h.length, 16)
    assert.strictEqual(h, '45ab6734b21e6968')
  })

  it('should hash a file', async () => {
    const filePath = join(project.testDir, 'test.txt')
    await writeFile(filePath, 'hello world')
    const h = await hashFile(filePath)
    assert.strictEqual(h, '45ab6734b21e6968')
  })

  it('should detect file changes', async () => {
    const filePath = join(project.testDir, 'test.txt')
    await writeFile(filePath, 'content v1')

    const { changed: changed1, metadata: meta1 } = await checkFileChange(filePath)
    assert.strictEqual(changed1, true)
    assert.ok(meta1.hash)

    const { changed: changed2, metadata: meta2 } = await checkFileChange(filePath, meta1)
    assert.strictEqual(changed2, false)
    assert.deepEqual(meta1, meta2)

    // Change content (different size)
    await writeFile(filePath, 'content v2-extended')
    const { changed: changed3, metadata: meta3 } = await checkFileChange(filePath, meta1)
    assert.strictEqual(changed3, true, 'Should detect change when size changes')
    assert.notStrictEqual(meta1.hash, meta3.hash)

    // Change content (same size, ensure mtime is different)
    const meta3_forced = {
      ...meta3,
      mtime: meta3.mtime - 1000
    }
    await writeFile(filePath, 'content v3-extended')
    const { changed: changed4, metadata: meta4 } = await checkFileChange(filePath, meta3_forced)
    assert.strictEqual(changed4, true, 'Should detect change when hash changes even if size is same')
    assert.notStrictEqual(meta3.hash, meta4.hash)
  })
})
