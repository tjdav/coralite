import { readFile } from 'node:fs/promises'

/**
 * Converts a kebab-case string to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} - The camelCase version of the string
 */
function kebabToCamel (str) {
  // replace each dash followed by a letter with the uppercase version of the letter
  return str.replace(/[-|:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase()
  })
}

/**
 * Converts all keys in an object from kebab-case to camelCase
 * @template {Object} T
 * @param {T} object - The object with kebab-case keys
 * @returns {T} - A new object with camelCase keys
 */
export function cleanKeys (object) {
  const result = Object.assign({}, object)

  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      // convert the kebab-case key to camelCase and assign the value to the new object
      result[kebabToCamel(key)] = object[key]
    }
  }

  return result
}

/**
 * @typedef {Object} PackageJson
 * @property {string} name
 * @property {string} description
 * @property {string} version
 */

/**
 * Get package.json
 * @return {Promise<PackageJson>}
 */
export async function getPkg () {
  try {
    const pkgPath = await readFile(new URL('../package.json', import.meta.url), { encoding: 'utf8' })

    return JSON.parse(pkgPath)
  } catch (err) {
    console.error(err.message)
  }
}

