import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createManifestStore, createEmptyManifest } from '../../../../../lib/server/utils/manifest-store.js'
import { createTestProject } from '../../../utils/project.js'

/**
 * Populates a manifest with a representative set of entries.
 *
 * @param {number} count - Number of physical entries to add.
 * @returns {Object} Manifest fixture.
 */
function populatedManifest (count) {
  const manifest = createEmptyManifest()
  for (let index = 0; index < count; index++) {
    const key = `/posts/post-${index}/`
    manifest.physical[key] = {
      mtime: index,
      size: 100,
      hash: `hash-${index}`,
      cacheKey: `key-${index}`
    }
    manifest.virtual[key] = { cacheKey: `virtual-${index}` }
  }
  manifest.dependencies = { 'x-card': ['/posts/post-0/'] }
  manifest.components = { 'x-card': { hash: 'component-hash' } }
  manifest.failed = []
  return manifest
}

describe('Manifest Store', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('round-trips a single manifest with compact JSON', async () => {
    const cacheDir = join(project.testDir, 'single')
    const store = createManifestStore({ cacheDir })
    const manifest = populatedManifest(5)

    await store.save(manifest)
    const loaded = await store.load()

    assert.deepEqual(loaded, manifest)
    const raw = await readFile(join(cacheDir, 'manifest.json'), 'utf8')
    assert.ok(!raw.includes('\n  '), 'single manifest should not be pretty-printed')
  })

  it('round-trips entries across shards', async () => {
    const cacheDir = join(project.testDir, 'sharded')
    const store = createManifestStore({
      cacheDir,
      shards: 4
    })
    const manifest = populatedManifest(20)

    await store.save(manifest)
    const loaded = await store.load()

    assert.deepEqual(loaded, manifest)
    assert.equal(store.shardCount, 4)
    await assert.rejects(() => stat(join(cacheDir, 'manifest.json')))
  })

  it('migrates an existing single manifest on save', async () => {
    const cacheDir = join(project.testDir, 'migration')
    const notices = []
    const manifest = populatedManifest(3)
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(cacheDir, 'manifest.json'), JSON.stringify(manifest))

    const store = createManifestStore({
      cacheDir,
      shards: 2,
      onWarn: message => notices.push(message)
    })
    const loaded = await store.load()
    assert.equal(Object.keys(loaded.physical).length, 3)
    assert.ok(notices.some(message => message.includes('Migrated')))

    await store.save(loaded)
    const reloaded = await store.load()
    assert.deepEqual(reloaded, manifest)
    await assert.rejects(() => stat(join(cacheDir, 'manifest.json')))
  })

  it('uses sharded storage for incremental builds', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    const cacheDir = join(project.testDir, 'sharded-build')
    const coralite = await project.createCoralite({
      output: undefined,
      cacheDir,
      manifestShards: 4
    })

    const first = await coralite.build()
    assert.equal(first.length, 1)
    assert.equal(first[0].status, undefined)

    const second = await coralite.build()
    assert.equal(second[0].status, 'skipped')
    await assert.rejects(() => stat(join(cacheDir, 'manifest.json')))
    const files = await readdir(join(cacheDir, 'manifest-shards'))
    assert.ok(files.some(name => name.startsWith('shard-')))
  })

  it('does not resurrect stale shards after switching shard counts', async () => {
    const cacheDir = join(project.testDir, 'switch')
    await createManifestStore({
      cacheDir,
      shards: 4
    }).save(populatedManifest(4))
    const current = populatedManifest(2)
    await createManifestStore({ cacheDir }).save(current)

    const reloaded = await createManifestStore({
      cacheDir,
      shards: 4
    }).load()
    assert.deepEqual(reloaded, current)
  })

  it('starts fresh when the stored manifest version is stale', async () => {
    const cacheDir = join(project.testDir, 'stale')
    const stale = populatedManifest(2)
    stale.version = 1
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(cacheDir, 'manifest.json'), JSON.stringify(stale))

    const loaded = await createManifestStore({ cacheDir }).load()
    assert.deepEqual(loaded, createEmptyManifest())
  })
})
