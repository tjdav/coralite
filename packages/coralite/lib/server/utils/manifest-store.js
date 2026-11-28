import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MANIFEST_VERSION } from './manifest.js'

const SHARD_PATTERN = /^shard-(\d+)\.json$/

/**
 * Creates an empty manifest with the current schema version.
 *
 * @returns {Object} A new empty manifest.
 */
export function createEmptyManifest () {
  return {
    version: MANIFEST_VERSION,
    physical: {},
    virtual: {},
    dependencies: {},
    components: {}
  }
}

/**
 * Maps a manifest key to a stable hash bucket.
 *
 * @param {string} key - Physical or virtual output path.
 * @param {number} shards - Number of buckets.
 * @returns {number} Bucket index.
 */
function shardIndex (key, shards) {
  let value = 2166136261
  for (let index = 0; index < key.length; index++) {
    value ^= key.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0) % shards
}

/**
 * Reads and validates a JSON manifest file.
 *
 * @param {string} filePath - File to read.
 * @param {(message: string) => void} [onWarn] - Optional parse-failure notice sink.
 * @returns {Promise<Object|null>} Parsed manifest, or null when unusable.
 */
async function readManifestFile (filePath, onWarn = () => {
}) {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'))
    if (!parsed || parsed.version !== MANIFEST_VERSION) {
      return null
    }
    if (!parsed.physical) {
      parsed.physical = {}
    }
    if (!parsed.virtual) {
      parsed.virtual = {}
    }
    if (!parsed.components) {
      parsed.components = {}
    }
    return parsed
  } catch (error) {
    if (error.code !== 'ENOENT') {
      onWarn(`Could not parse manifest at ${filePath}: ${error.message}. Starting with fresh manifest.`)
    }
    return null
  }
}

/**
 * Writes a JSON file atomically through a temporary sibling.
 *
 * @param {string} filePath - Destination file.
 * @param {Object} value - Value to serialize compactly.
 * @returns {Promise<void>} Resolves when the rename completes.
 */
async function writeJsonAtomic (filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(value))
  await rename(tempPath, filePath)
}

/**
 * Creates a manifest store that persists either one JSON document or shards.
 *
 * @param {Object} options - Store options.
 * @param {string} options.cacheDir - Directory that holds the build cache.
 * @param {number} [options.shards] - Hash buckets; 1 keeps the legacy single file.
 * @param {(message: string) => void} [options.onWarn] - Optional migration notice sink.
 * @returns {Object} Manifest store with load() and save().
 */
export function createManifestStore ({
  cacheDir, shards = 1, onWarn = () => {
  }
}) {
  const shardCount = Number.isInteger(shards) && shards > 1 ? shards : 1
  const legacyPath = join(cacheDir, 'manifest.json')
  const shardDir = join(cacheDir, 'manifest-shards')

  /**
   * Loads the sharded manifest, returning null when any part is missing.
   *
   * @returns {Promise<Object|null>} Assembled manifest or null.
   */
  async function loadSharded () {
    const meta = await readManifestFile(join(shardDir, 'meta.json'), onWarn)
    if (!meta) {
      return null
    }

    const loadedShards = await Promise.all(
      Array.from({ length: shardCount }, (_, index) => readManifestFile(join(shardDir, `shard-${String(index).padStart(3, '0')}.json`), onWarn))
    )
    if (loadedShards.some(shard => !shard)) {
      return null
    }

    const manifest = {
      ...meta,
      physical: {},
      virtual: {}
    }
    for (const shard of loadedShards) {
      Object.assign(manifest.physical, shard.physical)
      Object.assign(manifest.virtual, shard.virtual)
    }
    return manifest
  }

  /**
   * Loads the manifest, migrating an existing single document on first save.
   *
   * @returns {Promise<Object>} Loaded or default manifest.
   */
  async function load () {
    if (shardCount === 1) {
      return (await readManifestFile(legacyPath, onWarn)) || createEmptyManifest()
    }

    const sharded = await loadSharded()
    if (sharded) {
      return sharded
    }

    const legacy = await readManifestFile(legacyPath, onWarn)
    if (legacy) {
      onWarn('Migrated incremental manifest to sharded storage')
    }
    return legacy || createEmptyManifest()
  }

  /**
   * Saves the manifest to one document or to hash-bucketed shards.
   *
   * @param {Object} manifest - Manifest to persist.
   * @returns {Promise<void>} Resolves when all files are written.
   */
  async function save (manifest) {
    if (shardCount === 1) {
      await writeJsonAtomic(legacyPath, manifest)
      await rm(shardDir, {
        recursive: true,
        force: true
      })
      return
    }

    const meta = { ...manifest }
    delete meta.physical
    delete meta.virtual

    const buckets = Array.from({ length: shardCount }, () => ({
      version: MANIFEST_VERSION,
      physical: {},
      virtual: {}
    }))

    for (const [key, value] of Object.entries(manifest.physical || {})) {
      buckets[shardIndex(key, shardCount)].physical[key] = value
    }
    for (const [key, value] of Object.entries(manifest.virtual || {})) {
      buckets[shardIndex(key, shardCount)].virtual[key] = value
    }

    await mkdir(shardDir, { recursive: true })
    await Promise.all([
      writeJsonAtomic(join(shardDir, 'meta.json'), meta),
      ...buckets.map((bucket, index) => writeJsonAtomic(join(shardDir, `shard-${String(index).padStart(3, '0')}.json`), bucket))
    ])

    await rm(legacyPath, { force: true })
    for (const filename of await readdir(shardDir)) {
      const match = SHARD_PATTERN.exec(filename)
      if (match && Number(match[1]) >= shardCount) {
        await rm(join(shardDir, filename), { force: true })
      }
    }
  }

  return {
    load,
    save,
    shardCount,
    legacyPath,
    shardDir
  }
}
