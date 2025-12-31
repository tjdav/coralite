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
 * Normalizes function declarations to ensure consistent formatting.
 * Converts shorthand method syntax to full function declarations where needed,
 * while preserving arrow functions and existing full declarations.
 *
 * @param {Function} func - The function to normalize
 * @returns {string} The normalized function string representation
 */
export function normalizeFunction (func) {
  const original = func.toString().trim()

  // Find the first occurrence of either '{' or '=>'
  const firstBrace = original.indexOf('{')
  const firstArrow = original.indexOf('=>')

  // Determine the "Header Boundary"
  // If there's an arrow and it comes before a brace (or no brace exists),
  // it's an arrow function.
  const isArrow = firstArrow !== -1 && (firstBrace === -1 || firstArrow < firstBrace)

  if (isArrow) {
    // Return arrow functions as-is (e.g., log: (a) => a + 1)
    return original
  }

  // For non-arrows, extract header to check for shorthand
  const header = firstBrace !== -1 ? original.slice(0, firstBrace).trim() : original

  const isStandard = header.startsWith('function') || header.startsWith('async function')

  if (isStandard) {
    return original
  }

  // Handle Method Shorthand
  if (header.startsWith('async ')) {
    // Check for getters/setters
    if (header.startsWith('async get ') || header.startsWith('async set ')) {
      return original
    }

    // Capture the name (group 1) and allow $ in name
    return original.replace(/^async\s+([$\w]+)\s*\(/, 'async function $1(')
  } else {
    // Check for getters/setters
    if (header.startsWith('get ') || header.startsWith('set ')) return original

    // Capture the name (group 1) and allow $ in name
    return original.replace(/^([$\w]+)\s*\(/, 'function $1(')
  }
}
