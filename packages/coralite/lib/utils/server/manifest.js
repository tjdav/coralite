import { readFile, stat } from 'node:fs/promises'
import xxhash from 'xxhash-wasm'

/**
 * @typedef {import('xxhash-wasm').XXHashAPI['h64Raw']} XXHash64Raw
 */

/** @type {XXHash64Raw | undefined} */
let hasher

/** @type {Promise<void> | null} */
let initPromise = null

/**
 * Initializes the xxHash hasher.
 * This should be called during the application setup phase.
 * @returns {Promise<void>}
 */
export async function initHasher () {
  if (hasher) {
    return
  }
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const { h64Raw } = await xxhash()
    hasher = h64Raw
    initPromise = null
  })()

  return initPromise
}

/**
 * Generates an xxHash64 hash of a string or Buffer.
 * @param {string | Uint8Array} data - The data to hash.
 * @returns {string}
 */
export function hash (data) {
  if (!hasher) {
    throw new Error('Hasher not initialized. Call initHasher() first.')
  }
  const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hashBigInt = hasher(uint8Data)
  return hashBigInt.toString(16).padStart(16, '0')
}

/**
 * Generates a hash of a file's content.
 * @param {string} filepath - The path to the file.
 * @returns {Promise<string>}
 */
export async function hashFile (filepath) {
  const content = await readFile(filepath)
  return hash(content)
}

/**
 * Performs a two-tier check on a file to see if it has changed.
 * Tier 1: mtime and size.
 * Tier 2: Hash (xxHash64).
 *
 * @param {string} filepath - The path to the file.
 * @param {Object} previousMetadata - The previous metadata.
 * @returns {Promise<{ changed: boolean, metadata: Object }>}
 */
export async function checkFileChange (filepath, previousMetadata = {}) {
  const stats = await stat(filepath)
  const mtime = stats.mtimeMs
  const size = stats.size

  if (previousMetadata.mtime === mtime && previousMetadata.size === size) {
    return {
      changed: false,
      metadata: previousMetadata
    }
  }

  const hash = await hashFile(filepath)
  const metadata = {
    mtime,
    size,
    hash
  }

  if (previousMetadata.hash === hash) {
    // mtime changed but hash is same, still return changed: false to optimize
    // but update metadata for next time (to keep mtime/size in sync)
    return {
      changed: false,
      metadata
    }
  }

  return {
    changed: true,
    metadata
  }
}
