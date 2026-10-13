import { relative } from 'node:path'
import { CoraliteError } from '../../shared/errors.js'

/**
 * Parses a page file path relative to pagesRoot into a normalized route pattern,
 * parameter array, and segment array.
 *
 * @param {string} absolutePath - Page file absolute or relative path
 * @param {string} [pagesRoot=''] - Pages root directory absolute or relative path
 * @returns {{ pattern: string, params: string[], segments: Array<{ type: 'static'|'param', value: string }> }}
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
  /** @type {Array<{ type: 'static'|'param', value: string }>} */
  const segments = []

  const validParamRegex = /^\[(\.\.\.)?([a-zA-Z0-9_\-$]+)\]$/

  for (const seg of rawSegments) {
    if (seg.includes('[')) {
      const match = seg.match(validParamRegex)
      if (!match) {
        throw new CoraliteError(
          `Malformed dynamic segment "${seg}" in path "${absolutePath}".`,
          { filePath: absolutePath }
        )
      }
      const paramName = match[2]
      if (!params.includes(paramName)) {
        params.push(paramName)
      }
      segments.push({
        type: 'param',
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
    pattern = '/' + segments.map(s => (s.type === 'param' ? `:${s.value}` : s.value)).join('/')
  }

  return {
    pattern,
    params,
    segments
  }
}
