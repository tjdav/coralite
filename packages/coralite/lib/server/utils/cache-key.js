import { hash } from './manifest.js'
import { CoraliteError } from '../../shared/errors.js'

/**
 * Serializes a value into a deterministic string.
 *
 * Object keys are sorted, unordered collections are normalized, and values
 * that JSON cannot represent are tagged so repeated serializations of the same
 * shape always produce the same result. Circular references are marked rather
 * than throwing so page state containing shared references remains cacheable.
 *
 * @param {any} value - Value to serialize.
 * @param {WeakSet<Object>} [seen] - Objects on the current traversal path.
 * @returns {string} Deterministic serialization.
 */
export function stableSerialize (value, seen = new WeakSet()) {
  if (value === null) {
    return 'null'
  }

  const type = typeof value

  if (type === 'undefined') {
    return 'undefined'
  }
  if (type === 'string') {
    return JSON.stringify(value)
  }
  if (type === 'number') {
    if (Number.isNaN(value)) {
      return 'number:NaN'
    }
    if (value === Infinity) {
      return 'number:Infinity'
    }
    if (value === -Infinity) {
      return 'number:-Infinity'
    }
    if (Object.is(value, -0)) {
      return 'number:-0'
    }
    return `number:${value}`
  }
  if (type === 'boolean') {
    return `boolean:${value}`
  }
  if (type === 'bigint') {
    return `bigint:${value}`
  }
  if (type === 'symbol') {
    return `symbol:${value.description || ''}`
  }
  if (type === 'function') {
    return `function:${value.name || 'anonymous'}`
  }
  if (value instanceof Date) {
    return `date:${Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString()}`
  }
  if (value instanceof RegExp) {
    return `regexp:${value.toString()}`
  }
  if (value instanceof ArrayBuffer) {
    return `arraybuffer:[${Array.from(new Uint8Array(value)).join(',')}]`
  }
  if (seen.has(value)) {
    return '[Circular]'
  }

  seen.add(value)

  try {
    if (Array.isArray(value)) {
      return `[${value.map(item => stableSerialize(item, seen)).join(',')}]`
    }
    if (value instanceof Map) {
      const entries = []
      for (const [key, entryValue] of value) {
        entries.push(`${stableSerialize(key, seen)}=>${stableSerialize(entryValue, seen)}`)
      }
      entries.sort()
      return `Map{${entries.join(',')}}`
    }
    if (value instanceof Set) {
      const entries = Array.from(value, item => stableSerialize(item, seen))
      entries.sort()
      return `Set{${entries.join(',')}}`
    }
    if (value instanceof DataView) {
      const bytes = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      return `dataview:[${bytes.join(',')}]`
    }
    if (ArrayBuffer.isView(value)) {
      /** @type {any} */
      const view = value
      const items = []
      for (let i = 0; i < view.length; i++) {
        items.push(stableSerialize(view[i], seen))
      }
      return `${view.constructor.name}[${items.join(',')}]`
    }

    const keys = Object.keys(value).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`).join(',')}}`
  } finally {
    seen.delete(value)
  }
}

/**
 * Resolves a state-independent pre-render cache key.
 *
 * @param {Object} options - Pre-render key options.
 * @param {any} [options.pageExports] - Evaluated page exports.
 * @param {any} [options.route] - Concrete route for this output.
 * @param {any} [options.page] - Page context.
 * @returns {Promise<string|null>} Resolved key, or null when no hook is declared.
 * @throws {CoraliteError} CORALITE-E404 when a custom key returns an invalid type.
 */
export async function createPreRenderKey ({ pageExports = null, route = null, page = null } = {}) {
  if (!pageExports || typeof pageExports.preRenderKey !== 'function') {
    return null
  }

  const value = await pageExports.preRenderKey({
    route,
    page
  })

  if (typeof value !== 'string' && typeof value !== 'number') {
    /** @type {string} */
    let received = typeof value
    if (value === null) {
      received = 'null'
    } else if (Array.isArray(value)) {
      received = 'array'
    }
    throw new CoraliteError(
      `Page preRenderKey() must return a string or number, received ${received}.`,
      {
        code: 'CORALITE-E404',
        filePath: page?.file?.pathname
      }
    )
  }

  return String(value)
}

/**
 * Creates the page-state snapshot used by the default cache key.
 *
 * The framework `page` object is excluded because it holds exports and file
 * metadata, but `page.meta` is included because server handlers may mutate it
 * directly to change the rendered document.
 *
 * @param {any} state - Resolved page state.
 * @param {any} page - Page context.
 * @returns {Object} Snapshot suitable for stable serialization.
 */
function createStateSnapshot (state, page) {
  const snapshot = {}

  if (state && typeof state === 'object') {
    for (const key of Object.keys(state).sort()) {
      if (key === 'page') {
        continue
      }
      snapshot[key] = state[key]
    }
  }

  if (page && page.meta && typeof page.meta === 'object') {
    snapshot.$pageMeta = page.meta
  }

  return snapshot
}

/**
 * Resolves the incremental cache key for a page output.
 *
 * A page-level `cacheKey()` handler replaces the default key entirely. Without
 * one, a `preRenderKey()` handler is used when declared, so state-independent
 * keys stay stable across builds. Otherwise the key is an xxHash of the sorted
 * route parameters, route path and pattern, and the stable serialization of
 * resolved page state.
 *
 * @param {Object} options - Cache-key options.
 * @param {any} [options.pageExports] - Evaluated page exports.
 * @param {any} [options.route] - Concrete route for this output.
 * @param {any} [options.state] - Resolved page state.
 * @param {any} [options.page] - Page context.
 * @returns {Promise<string>} Stable cache key.
 * @throws {CoraliteError} CORALITE-E404 when a custom key returns an invalid type.
 */
export async function createPageCacheKey ({ pageExports = null, route = null, state = null, page = null } = {}) {
  if (pageExports && typeof pageExports.cacheKey === 'function') {
    const value = await pageExports.cacheKey({
      route,
      state
    })

    if (typeof value !== 'string' && typeof value !== 'number') {
      /** @type {string} */
      let received = typeof value
      if (value === null) {
        received = 'null'
      } else if (Array.isArray(value)) {
        received = 'array'
      }
      throw new CoraliteError(
        `Page cacheKey() must return a string or number, received ${received}.`,
        {
          code: 'CORALITE-E404',
          filePath: page?.file?.pathname
        }
      )
    }

    return String(value)
  }

  const preRenderKey = await createPreRenderKey({
    pageExports,
    route,
    page
  })
  if (preRenderKey !== null) {
    return preRenderKey
  }

  return hash(stableSerialize({
    params: route?.params || {},
    path: route?.path || '',
    pattern: route?.pattern || '',
    state: createStateSnapshot(state, page)
  }))
}
