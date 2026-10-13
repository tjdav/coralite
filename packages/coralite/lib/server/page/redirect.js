import { CoraliteBuildError } from '../../shared/errors.js'

/**
 * Validates and normalizes a __redirect declaration.
 *
 * @param {any} redirect - The __redirect value from page state.
 * @param {string} filePath - Page file path or output path for error messages.
 * @returns {{ to: string, status: number }} Normalized redirect configuration.
 * @throws {CoraliteBuildError} On shape, to, or status validation errors.
 */
export function validateAndNormalizeRedirect (redirect, filePath) {
  if (!redirect || typeof redirect !== 'object' || Array.isArray(redirect)) {
    throw new CoraliteBuildError(
      `Page "${filePath}": invalid "__redirect" field - must be a plain object.`,
      { filePath }
    )
  }

  const { to, status = 302 } = redirect

  if (typeof to !== 'string' || to.trim() === '') {
    throw new CoraliteBuildError(
      `Page "${filePath}": invalid "to" field in __redirect - must be a non-empty string.`,
      { filePath }
    )
  }

  if (!to.startsWith('/') && !to.startsWith('http://') && !to.startsWith('https://')) {
    throw new CoraliteBuildError(
      `Page "${filePath}": invalid "to" field in __redirect ("${to}") - must start with "/", "http://", or "https://".`,
      { filePath }
    )
  }

  if (status !== 301 && status !== 302) {
    throw new CoraliteBuildError(
      `Page "${filePath}": invalid "status" field in __redirect (${status}) - must be 301 or 302.`,
      { filePath }
    )
  }

  return {
    to,
    status
  }
}

/**
 * Generates the minimal HTML redirect stub.
 *
 * @param {string} to - Target URL or path.
 * @returns {string} Minimal HTML redirect stub string.
 */
export function generateRedirectStub (to) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${to}">
  <link rel="canonical" href="${to}">
  <title>Redirecting...</title>
  <script>location.replace('${to}')</script>
</head>
<body>
  <p>Redirecting to <a href="${to}">${to}</a></p>
</body>
</html>`
}
