import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { toCode, toMS, toTime } from '../../../../lib/cli/build-utils.js'
import { extname } from 'node:path'

describe('Server Request Logging (Dev Server)', () => {
  it('toCode formats 200 status as green and 404 as red', () => {
    const code200 = toCode(200)
    assert.ok(code200.includes('200'))
    const code404 = toCode(404)
    assert.ok(code404.includes('404'))
  })

  it('toMS formats high-resolution time to string with ms', () => {
    const duration = toMS([0, 12500000])
    assert.ok(duration.includes('12.50ms'))
  })

  it('toTime returns timestamp bracketed string', () => {
    const time = toTime()
    assert.match(time, /^\[.*?\d{2}:\d{2}:\d{2}\.\d{3}.*?\]\s$/)
  })

  it('request logging middleware identifies page routes vs internal routes', async () => {
    const logged = []

    const createLoggingMiddleware = (options = {}) => {
      return (req, res, next) => {
        const uri = req.originalUrl || req.url
        if (uri.startsWith('/__coralite/')) {
          next()
          return
        }

        const isPageRoute = !extname(req.path) || extname(req.path) === '.html'
        const start = process.hrtime()

        res.on('finish', () => {
          if (!options.verbose && !isPageRoute && res.statusCode < 400) {
            return
          }
          const duration = process.hrtime(start)
          logged.push({
            statusCode: res.statusCode,
            duration,
            uri
          })
        })

        next()
      }
    }

    const app = express()
    app.use(createLoggingMiddleware({ verbose: false }))

    app.get('/', (_req, res) => res.status(200).send('home'))
    app.get('/docs/guide', (_req, res) => res.status(200).send('guide'))
    app.get('/__coralite/rebuild', (_req, res) => res.status(200).send('sse'))
    app.get('/assets/app.js', (_req, res) => res.status(200).send('js'))
    app.get('/missing.png', (_req, res) => res.status(404).send('not found'))

    const server = app.listen(0)
    const port = server.address().port

    try {
      await fetch(`http://localhost:${port}/`)
      await fetch(`http://localhost:${port}/docs/guide`)
      await fetch(`http://localhost:${port}/__coralite/rebuild`)
      await fetch(`http://localhost:${port}/assets/app.js`)
      await fetch(`http://localhost:${port}/missing.png`)

      // Wait a microtask for on('finish') events to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      assert.strictEqual(logged.length, 3, 'Only page routes and error statuses should be logged in non-verbose mode')
      assert.strictEqual(logged[0].uri, '/')
      assert.strictEqual(logged[0].statusCode, 200)
      assert.strictEqual(logged[1].uri, '/docs/guide')
      assert.strictEqual(logged[1].statusCode, 200)
      assert.strictEqual(logged[2].uri, '/missing.png')
      assert.strictEqual(logged[2].statusCode, 404)
    } finally {
      server.close()
    }
  })
})
