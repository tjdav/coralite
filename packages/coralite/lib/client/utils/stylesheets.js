/**
 * @import { CoraliteImportCSS, CoraliteCssImportResult } from '../../../types/index.js'
 */

const URL_PROTOCOL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i
const URL_LIKE_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.{1,2}\/)/i

/**
 * Creates an abort error compatible with the DOMException contract.
 *
 * @returns {Error} Abort error.
 */
function createAbortError () {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }

  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

/**
 * Races a promise against an abort signal without cancelling the underlying work.
 *
 * @param {Promise<CoraliteCssImportResult>} promise - The stylesheet load promise.
 * @param {AbortSignal} [signal] - Optional abort signal.
 * @returns {Promise<CoraliteCssImportResult>} Abortable load promise.
 */
function raceWithSignal (promise, signal) {
  if (!signal) {
    return promise
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

/**
 * Resolves a declared stylesheet href against the configured base path.
 *
 * @param {string} href - Manifest href or raw URL.
 * @param {string} base - Configured base path with a trailing slash.
 * @returns {string} Resolved href.
 */
function resolveHref (href, base) {
  if (URL_PROTOCOL_REGEX.test(href)) {
    return href
  }
  return base + href
}

/**
 * Returns true when a value looks like a URL rather than a declared handle.
 *
 * @param {string} value - Stylesheet handle or URL.
 * @returns {boolean} Whether the value should be treated as a URL.
 */
function looksLikeUrl (value) {
  return URL_LIKE_REGEX.test(value) || value.includes('/') || /\.[a-z0-9]+$/i.test(value)
}

/**
 * Normalizes flat and `with`-nested CSS import options.
 *
 * @param {Object} [options={}] - Raw import options.
 * @returns {{ media?: string, nonce?: string, crossorigin?: string, referrerPolicy?: string, signal?: AbortSignal, force?: boolean }} Normalized options.
 */
function normalizeImportOptions (options = {}) {
  const raw = options && typeof options === 'object' ? options : {}
  const withAttrs = raw.with && typeof raw.with === 'object' ? raw.with : {}

  return {
    media: raw.media ?? withAttrs.media,
    nonce: raw.nonce ?? withAttrs.nonce,
    crossorigin: raw.crossorigin ?? withAttrs.crossorigin,
    referrerPolicy: raw.referrerPolicy ?? raw.referrerpolicy ?? withAttrs.referrerPolicy ?? withAttrs.referrerpolicy,
    signal: raw.signal,
    force: raw.force === true
  }
}

/**
 * Creates the client-side `importCSS` helper backing dynamic `await import('*.css')` expressions.
 *
 * @param {Object} options - Helper options.
 * @param {string} options.base - Configured base path.
 * @param {Object} options.manifest - Component manifest containing a `stylesheets` map.
 * @returns {CoraliteImportCSS} Stylesheet importer.
 */
export function createImportCSS ({ base, manifest }) {
  const resolvedBase = base.endsWith('/') ? base : base + '/'
  const pending = new Map()

  const getDeclaration = (handle) => {
    if (!manifest || !manifest.stylesheets) {
      return null
    }
    return Object.prototype.hasOwnProperty.call(manifest.stylesheets, handle)
      ? manifest.stylesheets[handle]
      : null
  }

  const findExistingLink = (href) => {
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    for (let i = 0; i < links.length; i++) {
      /** @type {any} */
      const link = links[i]
      if (link.getAttribute('href') === href) {
        return link
      }
    }
    return null
  }

  const insertLink = (link, order) => {
    const parent = document.head || document.documentElement
    if (order === undefined) {
      parent.appendChild(link)
      return
    }

    const lazyLinks = parent.querySelectorAll('link[data-coralite-stylesheet]')
    for (let i = 0; i < lazyLinks.length; i++) {
      const existing = lazyLinks[i]
      const existingOrder = Number(existing.getAttribute('data-coralite-stylesheet-order'))
      if (Number.isFinite(existingOrder) && existingOrder > order) {
        parent.insertBefore(link, existing)
        return
      }
    }

    parent.appendChild(link)
  }

  const inject = (href, attributes, order) => {
    const state = typeof window !== 'undefined' ? window['__coralite__']?.state : null
    const loadedStyles = state?.stylesLoaded || null
    const existingLink = findExistingLink(href)

    if (loadedStyles && loadedStyles.has(href) && existingLink) {
      return Promise.resolve({
        default: existingLink.sheet ?? null,
        link: existingLink
      })
    }

    if (existingLink && existingLink.sheet) {
      if (loadedStyles) {
        loadedStyles.add(href)
      }
      return Promise.resolve({
        default: existingLink.sheet,
        link: existingLink
      })
    }

    /** @type {any} */
    const link = existingLink || document.createElement('link')
    link.setAttribute('rel', 'stylesheet')
    link.setAttribute('href', href)

    if (attributes.media) {
      link.setAttribute('media', attributes.media)
    }
    if (attributes.nonce) {
      link.setAttribute('nonce', attributes.nonce)
      link.nonce = attributes.nonce
    }
    if (attributes.crossorigin) {
      link.setAttribute('crossorigin', attributes.crossorigin)
    }
    if (attributes.referrerPolicy) {
      link.setAttribute('referrerpolicy', attributes.referrerPolicy)
    }
    if (order !== undefined) {
      link.setAttribute('data-coralite-stylesheet', '')
      link.setAttribute('data-coralite-stylesheet-order', String(order))
    }

    if (!existingLink) {
      insertLink(link, order)
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        link.removeEventListener('load', onLoad)
        link.removeEventListener('error', onError)
      }

      const onLoad = () => {
        cleanup()
        if (loadedStyles) {
          loadedStyles.add(href)
        }
        resolve({
          default: link.sheet ?? null,
          link
        })
      }

      const onError = () => {
        cleanup()
        if (loadedStyles) {
          loadedStyles.delete(href)
        }
        if (link.parentNode) {
          link.parentNode.removeChild(link)
        }
        /** @type {Error & { href?: string }} */
        const error = new Error(`Failed to load stylesheet: ${href}`)
        error.href = href
        reject(error)
      }

      link.addEventListener('load', onLoad)
      link.addEventListener('error', onError)
    })
  }

  const importCSS = (handleOrUrl, rawOptions = {}) => {
    if (typeof handleOrUrl !== 'string' || handleOrUrl.trim() === '') {
      return Promise.reject(new TypeError('importCSS requires a non-empty stylesheet handle or URL.'))
    }

    const options = normalizeImportOptions(rawOptions)
    const declaration = getDeclaration(handleOrUrl)
    let href
    let meta

    if (declaration) {
      meta = typeof declaration === 'string' ? { href: declaration } : declaration
      href = resolveHref(meta.href, resolvedBase)
    } else if (looksLikeUrl(handleOrUrl)) {
      meta = {}
      href = handleOrUrl
    } else {
      return Promise.reject(new Error(`Unknown stylesheet handle "${handleOrUrl}". Import a valid .css file or pass an absolute/relative URL.`))
    }

    const attributes = {
      media: options.media ?? meta.media,
      nonce: options.nonce ?? meta.nonce,
      crossorigin: options.crossorigin ?? meta.crossorigin,
      referrerPolicy: options.referrerPolicy ?? meta.referrerPolicy
    }

    const key = [
      href,
      attributes.media || '',
      attributes.crossorigin || '',
      attributes.referrerPolicy || ''
    ].join('|')

    let promise = pending.get(key)

    if (!promise || options.force) {
      promise = inject(href, attributes, meta.order)
      pending.set(key, promise)
      promise.catch(() => {
        /* prevent unhandled rejections for cached failures */
      })
    }

    return raceWithSignal(promise, options.signal)
  }

  return importCSS
}

export default createImportCSS
