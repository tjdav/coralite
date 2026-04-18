/**
 * Generates a deeply nested object with arrays at each level.
 * Designed to stress-test deep merge operations (like `mergePluginState`)
 * by forcing recursive object traversal and wide array allocations.
 *
 * @param {number} [depth=10] - The maximum nesting depth of the object tree.
 * @param {number} [width=5] - The number of child object keys and array elements at each level.
 * @returns {Object | string} The generated deeply nested object, or a string at the leaf node.
 */
export function generateDeepObject (depth = 10, width = 5) {
  if (depth === 0) {
    return 'leaf_value'
  }
  const obj = {}
  for (let i = 0; i < width; i++) {
    obj[`key_${i}`] = generateDeepObject(depth - 1, width)
  }
  // Add an array at each level
  obj.arr = Array.from({ length: width }, (_, i) => `item_${i}`)
  return obj
}

/**
 * Generates a massive HTML string containing a single table with many rows.
 * Designed to test AST parsing and cloning performance on structures that are
 * relatively flat but extremely large in total node count.
 *
 * @param {number} [rows=10000] - The number of `<tr>` rows to generate inside the table.
 * @returns {string} The generated HTML string of the massive table.
 */
export function generateMassiveHTML (rows = 10000) {
  let html = '<table><tbody>\n'
  for (let i = 0; i < rows; i++) {
    html += `  <tr id="row-${i}">
    <td class="col-1">Data ${i}-1</td>
    <td class="col-2">Data ${i}-2</td>
    <td class="col-3">Data ${i}-3</td>
  </tr>\n`
  }
  html += '</tbody></table>'
  return html
}

/**
 * Generates an HTML tree that is both heavily nested (deep) and contains a massive list (wide).
 * Designed to test stack depth limits (recursive calls) and horizontal array allocations
 * in AST traversal tools like `cloneNode`.
 *
 * @param {number} [depth=20] - The number of nested `<div>` wrappers to create around the list.
 * @param {number} [items=5000] - The number of `<li>` items to generate inside the innermost `<ul>`.
 * @returns {string} The generated deep and wide HTML string.
 */
export function generateDeepWideHTML (depth = 20, items = 5000) {
  let inner = '<ul>\n'
  for (let i = 0; i < items; i++) {
    inner += `  <li class="item" data-index="${i}">Item ${i}</li>\n`
  }
  inner += '</ul>'

  let html = inner
  for (let i = 0; i < depth; i++) {
    html = `<div class="depth-${i}">\n${html}\n</div>`
  }
  return html
}

// Export pre-generated objects so we don't pay the generation cost during benchmark setup time
export const massiveState = generateDeepObject(10, 5)
export const massiveHTML = generateDeepWideHTML(20, 5000)
export const massiveHTMLRows = generateMassiveHTML(10000)
