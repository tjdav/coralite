import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const ROOT = resolve(import.meta.dirname, '..', 'dist')
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
}

// Text responses are compressed the way the production host serves them, so
// Lighthouse and the a11y suite see production transfer sizes.
const COMPRESSIBLE = new Set([
  '.html',
  '.css',
  '.js',
  '.json',
  '.xml',
  '.txt',
  '.md',
  '.svg',
  '.webmanifest'
])

const compressed = new Map()

/**
 * Resolves a URL pathname to a file inside dist.
 * @param {string} pathname - Request pathname.
 * @returns {string[]} Candidate file paths, most specific first.
 */
function candidates (pathname) {
  const target = resolve(ROOT, `.${pathname}`)
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return []
  }
  if (pathname.endsWith('/')) {
    return [resolve(target, 'index.html')]
  }
  return [target, resolve(target, 'index.html'), `${target}.html`]
}

/**
 * Picks the strongest encoding the client accepts.
 * @param {string} header - The request `accept-encoding` header.
 * @returns {'br' | 'gzip' | null} Selected encoding, or null when uncompressed.
 */
function negotiate (header) {
  if (/\bbr\b/.test(header)) {
    return 'br'
  }
  if (/\bgzip\b/.test(header)) {
    return 'gzip'
  }
  return null
}

/**
 * Compresses a body once per file version and encoding.
 * @param {string} file - Absolute file path.
 * @param {number} mtimeMs - File modification time.
 * @param {Buffer} body - Uncompressed file contents.
 * @param {'br' | 'gzip'} encoding - Selected encoding.
 * @returns {Buffer} Compressed body.
 */
function compress (file, mtimeMs, body, encoding) {
  const key = `${file}:${mtimeMs}:${encoding}`
  const cached = compressed.get(key)
  if (cached) {
    return cached
  }
  const result = encoding === 'br' ? brotliCompressSync(body) : gzipSync(body)
  compressed.set(key, result)
  return result
}

/**
 * Writes a file response with type, compression and cache semantics.
 * @param {import('node:http').ServerResponse} response - Response to write.
 * @param {string} file - Absolute file path.
 * @param {Buffer} body - File contents.
 * @param {number} mtimeMs - File modification time.
 * @param {'br' | 'gzip' | null} encoding - Selected encoding.
 * @param {number} [status] - HTTP status code.
 * @returns {void}
 */
function send (response, file, body, mtimeMs, encoding, status = 200) {
  const type = TYPES[extname(file)] || 'application/octet-stream'
  const headers = {
    'content-type': type,
    vary: 'accept-encoding'
  }
  const useEncoding = encoding && COMPRESSIBLE.has(extname(file)) ? encoding : null
  const payload = useEncoding ? compress(file, mtimeMs, body, useEncoding) : body
  if (useEncoding) {
    headers['content-encoding'] = useEncoding
  }
  headers['content-length'] = String(payload.byteLength)
  response.writeHead(status, headers)
  response.end(payload)
}

const server = createServer(async (request, response) => {
  const encoding = negotiate(request.headers['accept-encoding'] || '')
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }

  for (const file of candidates(pathname)) {
    try {
      const info = await stat(file)
      if (!info.isFile()) {
        continue
      }
      send(response, file, await readFile(file), info.mtimeMs, encoding)
      return
    } catch {
      // Try the next candidate.
    }
  }

  const notFound = resolve(ROOT, '404.html')
  try {
    const info = await stat(notFound)
    send(response, notFound, await readFile(notFound), info.mtimeMs, encoding, 404)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`)
})
