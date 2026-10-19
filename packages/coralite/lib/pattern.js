import { relative } from 'node:path'
import { CoraliteError } from './shared/errors.js'

/**
 * Parses a page file path relative to pagesRoot into a normalized route pattern,
 * parameter array, and segment array.
 *
 * @param {string} absolutePath - Page file absolute or relative path
 * @param {string} [pagesRoot=''] - Pages root directory absolute or relative path
 * @returns {{ pattern: string, params: string[], segments: Array<{ type: 'static'|'param'|'catchall', value: string }> }}
 */
export function parsePagePattern (absolutePath, pagesRoot = '') {
  const normAbs = (absolutePath || '').replace(/\\/g, '/')
  const normRoot = (pagesRoot || '').replace(/\\/g, '/').replace(/\/+$/, '')

  let relPath = normAbs
  if (normRoot && (normAbs.startsWith(normRoot + '/') || normAbs === normRoot)) {
    relPath = normAbs.slice(normRoot.length)
  } else if (pagesRoot) {
    relPath = relative(pagesRoot, absolutePath).replace(/\\/g, '/')
  }

  // Strip leading slashes and ./
  relPath = relPath.replace(/^(\.\/|\/)+/, '')

  // Collapse multiple slashes
  relPath = relPath.replace(/\/+/g, '/')

  // Strip .html extension if present
  if (relPath.endsWith('.html')) {
    relPath = relPath.slice(0, -5)
  }

  const rawSegments = relPath.split('/').filter(Boolean)

  if (rawSegments.length > 0 && rawSegments[rawSegments.length - 1] === 'index') {
    rawSegments.pop()
  }

  const params = []
  /** @type {Array<{ type: 'static'|'param'|'catchall', value: string }>} */
  const segments = []

  const validParamRegex = /^\[(\.\.\.)?([a-zA-Z0-9_\-$]+)\]$/

  // Pre-validate catch-all count across segments
  let catchAllCount = 0
  for (const seg of rawSegments) {
    if (seg.includes('[')) {
      const match = seg.match(validParamRegex)
      if (match && match[1]) {
        catchAllCount++
      }
    }
  }

  if (catchAllCount > 1) {
    throw new CoraliteError(
      `A pattern can have at most one catch-all segment in path "${absolutePath}".`,
      { filePath: absolutePath }
    )
  }

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i]
    if (seg.includes('[')) {
      const match = seg.match(validParamRegex)
      if (!match) {
        throw new CoraliteError(
          `Malformed dynamic segment "${seg}" in path "${absolutePath}".`,
          { filePath: absolutePath }
        )
      }
      const isCatchAll = Boolean(match[1])
      const paramName = match[2]

      if (isCatchAll && i !== rawSegments.length - 1) {
        throw new CoraliteError(
          `Catch-all segment must be the last segment in path "${absolutePath}".`,
          { filePath: absolutePath }
        )
      }

      if (!params.includes(paramName)) {
        params.push(paramName)
      }
      segments.push({
        type: isCatchAll ? 'catchall' : 'param',
        value: paramName
      })
    } else {
      segments.push({
        type: 'static',
        value: seg
      })
    }
  }

  let pattern = '/'
  if (segments.length > 0) {
    pattern = '/' + segments.map(s => {
      if (s.type === 'catchall') {
        return `:${s.value}*`
      }
      if (s.type === 'param') {
        return `:${s.value}`
      }
      return s.value
    }).join('/')
  }

  return {
    pattern,
    params,
    segments
  }
}
