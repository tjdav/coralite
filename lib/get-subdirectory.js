import { normalize, sep } from 'path'

/**
 * Compare two path names and get the diff from base
 * @param {string} base - Base directory
 * @param {string} path - Path name
 */
function getSubDirectory (base, path) {
  // normalize paths to handle different OS path separators
  const normalizedPath1 = normalize(base)
  const normalizedPath2 = normalize(path)

  // split paths into segments
  const segments1 = normalizedPath1.split(sep)
  const segments2 = normalizedPath2.split(sep)

  let i = 0
  while (i < segments1.length
    && i < segments2.length
    && segments1[i] === segments2[i]
  ) {
    i++
  }

  return segments2.slice(i).join(sep)
}

export default getSubDirectory
