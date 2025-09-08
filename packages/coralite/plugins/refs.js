/**
 * @callback CoraliteUseRef
 * @param {string} id - The identifier for the ref, corresponding to a key in the refs object
 * @returns {HTMLElement | null} The DOM element referenced by this ID, or null if not found
 */

/**
 * Creates a ref resolver function that maps IDs to DOM elements.
 *
 * @param {string[]} refs - An array of data-coralite-ref attribute values to be mapped
 * @returns {CoraliteUseRef} A function that resolves refs by their ID
 */
export const refs = (refs) => {
  const elements = {}

  return (id) => {
    if (elements[id]) {
      return elements[id]
    }

    const element = document.querySelector('[data-coralite-ref="' + refs[id] + '"]')

    if (element) {
      elements[id] = element
    }

    return element
  }
}

