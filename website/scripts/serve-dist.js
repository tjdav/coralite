import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

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

const server = createServer(async (request, response) => {
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
      const body = await readFile(file)
      response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
      response.end(body)
      return
    } catch {
      // Try the next candidate.
    }
  }

  try {
    const body = await readFile(resolve(ROOT, '404.html'))
    response.writeHead(404, { 'content-type': TYPES['.html'] })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`)
})
