import { createHash } from 'node:crypto'
import { createCoraliteElement } from './dom.js'
import { CoraliteError } from '../errors.js'

const ALLOWED_HASH_ALGORITHMS = new Set(['sha256', 'sha384', 'sha512'])

/**
 * Calculates base64-encoded SRI digest string (e.g. "sha384-...")
 * @param {string|Buffer} content - Asset content
 * @param {string} [algorithm='sha384'] - Hash algorithm ('sha256' | 'sha384' | 'sha512')
 * @returns {string} - Formatted SRI digest e.g. "sha384-abc..."
 */
export function calculateSRIDigest (content, algorithm = 'sha384') {
  if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
    return ''
  }
  if (!ALLOWED_HASH_ALGORITHMS.has(algorithm)) {
    throw new CoraliteError(`Invalid SRI hash algorithm: "${algorithm}". Allowed: sha256, sha384, sha512.`)
  }
  const hash = createHash(algorithm).update(content).digest('base64')
  return `${algorithm}-${hash}`
}

/**
 * Calculates base64-encoded CSP hash for a given content string
 * @param {string} content - Inline script or style content
 * @param {string} [algorithm='sha256'] - Hash algorithm ('sha256' | 'sha384' | 'sha512')
 * @returns {string} - Formatted hash string e.g. "'sha256-abc...'"
 */
export function calculateHash (content, algorithm = 'sha256') {
  if (typeof content !== 'string') {
    return ''
  }
  if (!ALLOWED_HASH_ALGORITHMS.has(algorithm)) {
    throw new CoraliteError(`Invalid CSP hash algorithm: "${algorithm}". Allowed: sha256, sha384, sha512.`)
  }
  const hash = createHash(algorithm).update(content, 'utf8').digest('base64')
  return `'${algorithm}-${hash}'`
}

/**
 * Resolves a nonce value from context, page meta, session, or config
 * @param {object} context - Context object containing build, page, session, or config settings
 * @returns {string|null}
 */
export function resolveNonce (context = {}) {
  const candidates = [
    context.buildOptions?.nonce,
    context.pageContext?.meta?.nonce,
    context.session?.nonce,
    context.config?.csp?.nonce
  ]

  for (let candidate of candidates) {
    if (typeof candidate === 'function') {
      try {
        candidate = candidate(context)
      } catch {
        continue
      }
    }
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim()
    }
  }

  return null
}

/**
 * Formats CSP directives into a single header / meta content string
 * @param {Record<string, string|string[]>} [directives={}] - Map of directive names to source lists
 * @param {object} [options={}] - Options object
 * @param {string[]} [options.scriptHashes=[]] - List of script hashes
 * @param {string[]} [options.styleHashes=[]] - List of style hashes
 * @param {string|null} [options.nonce=null] - Nonce value
 * @returns {string}
 */
export function formatCSPDirectives (directives = {}, { scriptHashes = [], styleHashes = [], nonce = null } = {}) {
  const merged = {}
  for (const [k, v] of Object.entries(directives)) {
    merged[k] = Array.isArray(v) ? [...v] : [v]
  }

  // script-src handling
  if (nonce) {
    merged['script-src'] = merged['script-src'] ? [...merged['script-src']] : ["'self'"]
    if (!merged['script-src'].includes("'strict-dynamic'")) {
      merged['script-src'].push("'strict-dynamic'")
    }
    const nonceSrc = `'nonce-${nonce}'`
    if (!merged['script-src'].includes(nonceSrc)) {
      merged['script-src'].push(nonceSrc)
    }
  } else if (scriptHashes.length > 0) {
    merged['script-src'] = merged['script-src'] ? [...merged['script-src']] : ["'self'"]
    for (const h of scriptHashes) {
      if (!merged['script-src'].includes(h)) {
        merged['script-src'].push(h)
      }
    }
  }

  // style-src handling
  if (nonce) {
    merged['style-src'] = merged['style-src'] ? [...merged['style-src']] : ["'self'"]
    const nonceSrc = `'nonce-${nonce}'`
    if (!merged['style-src'].includes(nonceSrc)) {
      merged['style-src'].push(nonceSrc)
    }
  } else if (styleHashes.length > 0) {
    merged['style-src'] = merged['style-src'] ? [...merged['style-src']] : ["'self'"]
    for (const h of styleHashes) {
      if (!merged['style-src'].includes(h)) {
        merged['style-src'].push(h)
      }
    }
  }

  return Object.entries(merged)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

/**
 * Injects a <meta http-equiv="Content-Security-Policy"> tag into document <head> or root
 * @param {object} root - AST root node
 * @param {object|null} head - AST head element node
 * @param {string} cspContent - Formatted CSP directive string
 * @param {boolean} [reportOnly=false] - Whether to use Content-Security-Policy-Report-Only
 */
export function injectCSPMeta (root, head, cspContent, reportOnly = false) {
  const metaElement = createCoraliteElement({
    type: 'tag',
    name: 'meta',
    parent: head || root,
    attribs: {
      'http-equiv': reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      content: cspContent
    },
    children: []
  })

  if (head) {
    head.children.unshift(metaElement)
  } else {
    root.children.unshift(metaElement)
  }
}
