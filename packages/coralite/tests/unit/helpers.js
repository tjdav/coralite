import { strict as assert } from 'node:assert'

/**
 * Produces a short, allocation-safe description of a value.
 *
 * Node's assertion diff formatter deep-inspects the compared operands. DOM nodes
 * expose a cyclic, richly connected object graph (`ownerDocument -> document ->
 * window -> every node/getter`), so inspecting them can allocate without bound
 * and abort the process with "JavaScript heap out of memory". Tests must
 * therefore compare nodes by identity and report failures with short labels.
 *
 * @param {unknown} value - Value to describe.
 * @returns {string} Short label safe to embed in an assertion message.
 */
function label (value) {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'object' || typeof value === 'function') {
    /** @type {any} */
    const obj = value
    if (typeof obj.nodeName === 'string') {
      const id = typeof obj.id === 'string' && obj.id ? `#${obj.id}` : ''
      return `<${obj.nodeName.toLowerCase()}${id}>`
    }
    if (Array.isArray(value)) {
      return `<Array(${value.length})>`
    }
    if (typeof obj.name === 'string' && obj.name) {
      return `<${obj.name}>`
    }
    return `<${obj.constructor && obj.constructor.name ? obj.constructor.name : 'Object'}>`
  }
  return String(value)
}

/**
 * Asserts that two references are identical without deep-inspecting either
 * operand when the assertion fails.
 * @param {unknown} actual - Observed reference.
 * @param {unknown} expected - Expected reference.
 * @param {string} [message] - Optional failure message.
 * @returns {void}
 */
export function assertSame (actual, expected, message) {
  if (actual === expected) {
    return
  }
  const detail = `expected identical references, got ${label(actual)} !== ${label(expected)}`
  throw new assert.AssertionError({
    message: message ? `${message} (${detail})` : detail,
    actual: label(actual),
    expected: label(expected),
    operator: '==='
  })
}

/**
 * Asserts that two references are different without deep-inspecting either
 * operand when the assertion fails.
 * @param {unknown} actual - Observed reference.
 * @param {unknown} expected - Reference that must not match.
 * @param {string} [message] - Optional failure message.
 * @returns {void}
 */
export function assertNotSame (actual, expected, message) {
  if (actual !== expected) {
    return
  }
  const detail = `expected different references, both are ${label(actual)}`
  throw new assert.AssertionError({
    message: message ? `${message} (${detail})` : detail,
    actual: label(actual),
    expected: label(expected),
    operator: '!=='
  })
}

/**
 * Asserts that a node collection matches another node collection by order and
 * identity, reporting mismatches with index-level detail instead of dumping the
 * whole DOM graph.
 * @param {ArrayLike<unknown>|Iterable<unknown>} actual - Observed nodes.
 * @param {ArrayLike<unknown>|Iterable<unknown>} expected - Expected nodes.
 * @param {string} [message] - Optional failure message.
 * @returns {void}
 */
export function assertSameNodes (actual, expected, message) {
  const actualNodes = Array.from(/** @type {Iterable<unknown>} */ (actual))
  const expectedNodes = Array.from(/** @type {Iterable<unknown>} */ (expected))
  const prefix = message ? `${message}: ` : ''

  if (actualNodes.length !== expectedNodes.length) {
    throw new assert.AssertionError({
      message: `${prefix}expected ${expectedNodes.length} node(s) [${expectedNodes.map(label).join(', ')}] but received ${actualNodes.length} [${actualNodes.map(label).join(', ')}]`,
      actual: actualNodes.length,
      expected: expectedNodes.length,
      operator: '==='
    })
  }

  for (let i = 0; i < actualNodes.length; i++) {
    if (actualNodes[i] !== expectedNodes[i]) {
      throw new assert.AssertionError({
        message: `${prefix}node at index ${i} is not the expected reference (${label(actualNodes[i])} !== ${label(expectedNodes[i])})`,
        actual: label(actualNodes[i]),
        expected: label(expectedNodes[i]),
        operator: '==='
      })
    }
  }
}
