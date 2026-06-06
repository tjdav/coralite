import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'

/**
 * Generates an MD5 hash of a string or Buffer.
 * @param {string | Buffer} data - The data to hash.
 * @returns {string}
 */
export function md5 (data) {
  return createHash('md5').update(data).digest('hex')
}

/**
 * Generates an MD5 hash of a file's content.
 * @param {string} filepath - The path to the file.
 * @returns {Promise<string>}
 */
export async function hashFile (filepath) {
  const content = await readFile(filepath)
  return md5(content)
}

/**
 * Performs a two-tier check on a file to see if it has changed.
 * Tier 1: mtime and size.
 * Tier 2: MD5 hash.
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
