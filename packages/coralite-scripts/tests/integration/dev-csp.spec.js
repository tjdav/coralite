import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLiveReloadScript, attachDevRoutes } from '../../libs/server.js'
import express from 'express'
import http from 'node:http'

describe('Dev Server Live-Reload CSP', () => {
  it('formats rebuild script tag with external src and optional dev nonce', () => {
    const defaultTag = buildLiveReloadScript({})
    assert.equal(defaultTag.trim(), '<script src="/_/rebuild.js"></script>\n</body>')

    const noncedTag = buildLiveReloadScript({ csp: { nonce: 'dev-nonce-123' } })
    assert.equal(noncedTag.trim(), '<script src="/_/rebuild.js" nonce="dev-nonce-123"></script>\n</body>')
  })

  it('serves /_/rebuild.js route via attachDevRoutes', async () => {
    const app = express()
    attachDevRoutes(app)

    const server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const address = server.address()
    // @ts-ignore
    const port = address.port

    try {
      const res = await fetch(`http://127.0.0.1:${port}/_/rebuild.js`)
      assert.equal(res.status, 200)
      assert.ok(res.headers.get('content-type').startsWith('application/javascript'))
      const body = await res.text()
      assert.ok(body.includes("new EventSource('/_/rebuild')"))
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
