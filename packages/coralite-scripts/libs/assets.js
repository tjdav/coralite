/**
 * @import { CoraliteStaticAsset } from 'coralite'
 */

/**
 * Parses an asset mapping string into an asset object.
 *
 * @param {string} mapping - The mapping string (pkg:path:dest or src:dest).
 * @returns {CoraliteStaticAsset} The parsed asset object.
 * @throws {Error} If the mapping format is invalid.
 */
export function parseAssetMapping (mapping) {
  const parts = mapping.split(':')

  if (parts.length === 3) {
    // pkg:path:dest
    return {
      pkg: parts[0],
      path: parts[1],
      dest: parts[2]
    }
  } else if (parts.length === 2) {
    // src:dest
    const src = parts[0]
    if (!src.startsWith('.') && !src.startsWith('/') && !src.startsWith('..')) {
      throw new Error(`Invalid asset mapping "${mapping}". Local paths must start with ".", "..", or "/". NPM package mappings require 3 parts (pkg:path:dest).`)
    }
    return {
      src,
      dest: parts[1]
    }
  } else {
    throw new Error(`Invalid asset mapping "${mapping}". Expected format: pkg:path:dest or src:dest`)
  }
}

/**
 * Merges a list of CLI assets into an existing assets array, with CLI assets taking precedence on destination collisions.
 *
 * @param {CoraliteStaticAsset[]} baseAssets - The existing assets array.
 * @param {CoraliteStaticAsset[]} cliAssets - The new assets to merge.
 * @returns {CoraliteStaticAsset[]} The merged assets array.
 */
export function mergeAssets (baseAssets = [], cliAssets = []) {
  const merged = [...baseAssets]
  for (const cliAsset of cliAssets) {
    const index = merged.findIndex(a => a.dest === cliAsset.dest)
    if (index !== -1) {
      merged[index] = cliAsset
    } else {
      merged.push(cliAsset)
    }
  }
  return merged
}
