import { normalize, sep } from 'path'

/**
 * Compare two path names and get the diff from base
 * @param {string} base - Base directory
 * @param {string} path - Path name
 */
export function getSubDirectory (base, path) {
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

/**
 * Converts a kebab-case string to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} - The camelCase version of the string
 */
function kebabToCamel (str) {
  // Replace each dash followed by a letter with the uppercase version of the letter
  return str.replace(/[-|:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase()
  })
}

/**
 * Converts all keys in an object from kebab-case to camelCase
 * @param {Object} object - The object with kebab-case keys
 * @returns {Object} - A new object with camelCase keys
 */
export function cleanKeys (object) {
  const result = {}

  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      // Convert the kebab-case key to camelCase and assign the value to the new object
      result[kebabToCamel(key)] = object[key]
    }
  }

  return result
}
