/**
 * Creates a bounded least-recently-used cache for rendered pages.
 *
 * Entries may be registered under multiple alias keys (for example
 * `page.html` and `page/index.html`). Eviction removes the entry and every
 * alias together.
 *
 * @param {Object} [options] - Cache options.
 * @param {number} [options.maxEntries=256] - Maximum cached page entries. `0` disables caching.
 * @returns {{
 *   set: (keys: string[], value: any) => void,
 *   get: (key: string) => any,
 *   clear: () => void,
 *   setMaxEntries: (value: number) => void,
 *   size: number
 * }} Page cache.
 */
export function createPageCache ({ maxEntries = 256 } = {}) {
  const cache = new Map()
  const entries = new Set()
  let max = normalizeMax(maxEntries)

  const deleteEntry = (entry) => {
    for (const key of entry.keys) {
      cache.delete(key)
    }
    entries.delete(entry)
  }

  const trim = () => {
    while (entries.size > max) {
      const oldest = entries.values().next().value
      if (!oldest) {
        return
      }
      deleteEntry(oldest)
    }
  }

  return {
    set (keys, value) {
      if (max === 0) {
        return
      }

      const uniqueKeys = [...new Set(keys)]
      for (const key of uniqueKeys) {
        const existing = cache.get(key)
        if (existing) {
          deleteEntry(existing)
        }
      }

      const entry = {
        keys: new Set(uniqueKeys),
        value
      }
      for (const key of uniqueKeys) {
        cache.set(key, entry)
      }
      entries.add(entry)
      trim()
    },

    get (key) {
      const entry = cache.get(key)
      if (!entry) {
        return null
      }
      entries.delete(entry)
      entries.add(entry)
      return entry.value
    },

    clear () {
      cache.clear()
      entries.clear()
    },

    setMaxEntries (value) {
      max = normalizeMax(value)
      trim()
    },

    get size () {
      return entries.size
    }
  }
}

/**
 * Normalizes a cache-size value.
 *
 * @param {number} value - Candidate size.
 * @returns {number} Non-negative integer or Infinity.
 */
function normalizeMax (value) {
  if (!Number.isFinite(value)) {
    return Infinity
  }
  return Math.max(0, Math.floor(value))
}
