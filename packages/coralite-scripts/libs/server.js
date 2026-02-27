import express from 'express'
import colours from 'kleur'
import localAccess from 'local-access'
import chokidar from 'chokidar'
import buildSass from './build-sass.js'
import { displayError, displayInfo, displaySuccess, toCode, toMS, toTime } from './build-utils.js'
import { extname, join, normalize, relative, sep } from 'path'
import { readFile, access, constants } from 'fs/promises'
import Coralite from 'coralite'
import buildCSS from './build-css.js'
import { existsSync, mkdirSync } from 'fs'
import portfinder from 'portfinder'

/**
 * @import {CoraliteScriptConfig, CoraliteScriptOptions} from '../types/index.js'
 */

/**
 * Starts a development server with hot-reloading capabilities
 * @param {CoraliteScriptConfig} config - Coralite configuration
 * @param {CoraliteScriptOptions} options - Coralite configuration
 * @returns {Promise<void>}
 */
async function server (config, options) {
  try {
    const app = express()
    const startPort = config.server?.port && !isNaN(config.server.port) ? config.server.port : 3000

    // track active connections.
    const clients = new Set()
    const pageCache = new Map()
    const memoryPageSource = new Map()

    // start coralite
    displayInfo('Initializing Coralite...')
    const coralite = new Coralite({
      templates: config.templates,
      pages: config.pages,
      plugins: config.plugins,
      mode: 'development'
    })
    await coralite.initialise()
    displaySuccess('Coralite initialized successfully')

    if (config.plugins) {
      for (const plugin of config.plugins) {
        if (typeof plugin.server === 'function') {
          await plugin.server(app, coralite)
        }
      }
    }

    const watchPath = [
      config.public,
      config.pages,
      config.templates
    ]

    // no cache middleware
    app.use(function (req, res, next) {
      res.setHeader('Surrogate-Control', 'no-store')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Expires', '0')

      next()
    })

    // middleware to log request information including response time and status code
    app.use(function (req, res, next) {
      const start = process.hrtime()

      if (options.verbose) {
        // when the response is finished, calculate duration and log details
        res.on('finish', function () {
          const dash = colours.gray(' ─ ')
          const duration = process.hrtime(start)
          const uri = req.originalUrl || req.url

          // log the response time and status code
          process.stdout.write(toTime() + toCode(res.statusCode) + dash + toMS(duration) + dash + uri + '\n')
        })
      }

      next()
    })

    // check if Sass is configured and add its input directory to watchPath for file changes.
    if (config.styles) {
      if (config.styles.input) {
        if (!existsSync(config.styles.input)) {
          mkdirSync(config.styles.input)
        }

        watchPath.push(config.styles.input)

        app.use('/css', express.static(join(config.output, 'css'), {
          cacheControl: false
        }))
      } else {
        displayError('Coralite config styles input must not be empty.')
      }

      if (config.styles.type === 'sass' || config.styles.type === 'scss') {
        const start = process.hrtime()

        // rebuild CSS and send notification
        const results = await buildSass({
          ...config.styles,
          output: join(config.output, 'css'),
          start
        })

        let dash = colours.gray(' ─ ')

        for (let i = 0; i < results.length; i++) {
          const result = results[i]

          process.stdout.write(toTime() + colours.bgGreen(' Compiled SASS ') + dash + toMS(result.duration) + dash + result.input + '\n')
        }
      } else if (config.styles.type === 'css') {
        const start = process.hrtime()

        await buildCSS({
          input: config.styles.input,
          output: join(config.output, 'css'),
          plugins: config.cssPlugins,
          start
        })
      } else {
        displayError('Coralite config styles type must not be empty')
      }
    }

    app
      .use(express.static(config.public, {
        cacheControl: false
      }))
      .get('/_/rebuild', (req, res) => {
        // set headers for SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        })

        // add client to tracking set
        clients.add(res)

        // send initial connection message
        res.write('data: connected\n\n')

        // clean up on client disconnect
        req.on('close', () => {
          clients.delete(res)
          res.end()
        })
      })
      .get(/(.*)/, async (req, res) => {
        // extract the requested path and its extension.
        const reqPath = req.path
        const extension = extname(reqPath)

        // Only handle HTML requests or extension-less requests (assumed to be pages)
        if (extension && extension !== '.html') {
          return res.sendStatus(404)
        }

        const resolveSource = async () => {
          const candidates = []

          // Ensure relative path doesn't start with / for joining
          const relPath = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath

          if (reqPath.endsWith('/')) {
            const key = join(relPath, 'index.html')
            candidates.push({
              path: join(config.pages, key),
              key
            })
          } else if (extension === '.html') {
            const key = relPath
            candidates.push({
              path: join(config.pages, key),
              key
            })
          } else {
            // No extension, no trailing slash
            const key1 = relPath + '.html'
            candidates.push({
              path: join(config.pages, key1),
              key: key1
            })

            const key2 = join(relPath, 'index.html')
            candidates.push({
              path: join(config.pages, key2),
              key: key2
            })
          }

          for (const candidate of candidates) {
            try {
              await access(candidate.path, constants.R_OK)
              // Normalize key for consistency (use forward slashes)
              const normalizedKey = candidate.key.split(sep).join('/')
              return {
                pathname: candidate.path,
                key: normalizedKey
              }
            } catch {
              // continue
            }
          }

          // Fallback check memoryPageSource
          for (const candidate of candidates) {
            const normalizedKey = candidate.key.split(sep).join('/')
            if (memoryPageSource.has(normalizedKey)) {
              return {
                pathname: memoryPageSource.get(normalizedKey),
                key: normalizedKey
              }
            }
          }

          return null
        }

        const result = await resolveSource()

        if (!result) {
          res.sendStatus(404)
          return
        }

        const { pathname, key: cacheKey } = result

        if (pageCache.has(cacheKey)) {
          res.send(pageCache.get(cacheKey))
          return
        }

        try {
          const start = process.hrtime()
          let duration, dash = colours.gray(' ─ ')

          let rebuildScript = '\n<script>\n'
          rebuildScript += "    const eventSource = new EventSource('/_/rebuild');\n"
          rebuildScript += '    eventSource.onmessage = function(event) {\n'
          rebuildScript += "      if (event.data === 'connected') return;\n"
          rebuildScript += '      // Reload page when file changes\n'
          rebuildScript += '      location.reload()\n'
          rebuildScript += '    }\n'
          rebuildScript += '  </script>\n'
          rebuildScript += '</body>\n'

          await coralite.pages.setItem(pathname)
          // build the HTML for this page using the built-in compiler.
          const documents = await coralite.build(pathname, (result) => {
            // inject a script to enable live reload via Server-Sent Events
            const injectedHtml = result.html.replace(/<\/body>/i, rebuildScript)

            const relPath = relative(config.pages, result.path.pathname)
            const normalizedKey = relPath.split(sep).join('/')

            // map in memory page to source
            if (normalizedKey !== pathname) {
              memoryPageSource.set(normalizedKey, pathname)
            }

            // only cache pages that were out of scope of the initial page request
            if (normalizedKey !== cacheKey) {
              pageCache.set(normalizedKey, injectedHtml)
            }

            return {
              path: result.path,
              html: injectedHtml,
              duration: result.duration
            }
          })

          // prints time and path to the file that has been changed or added.
          duration = process.hrtime(start)
          process.stdout.write(toTime() + colours.bgGreen(' Compiled HTML ') + dash + toMS(duration) + dash + '/' + cacheKey + '\n')

          // find the document that matches the request path
          const doc = documents.find(doc => {
            const relPath = relative(config.pages, doc.path.pathname)
            const normalizedKey = relPath.split(sep).join('/')
            return normalizedKey === cacheKey
          })

          if (doc) {
            res.send(doc.html)
          } else {
            res.sendStatus(404)
          }
        } catch (error) {
          // If headers haven't been sent, send 500
          if (!res.headersSent) {
            res.status(500).send(error.message)
          }
          displayError('Request processing failed', error)
        }
      }
      )

    // watch for file changes
    const watcher = chokidar.watch(watchPath, {
      persistent: true,
      // Add ignoreInitial to prevent initial scan events
      ignoreInitial: true
    })

    const templatePath = normalize(config.templates)
    const pagesPath = normalize(config.pages)

    // Debouncing and compilation state management
    let compileTimeout = null
    let isCompiling = false
    const pendingChanges = new Set()

    // Helper function to debounce compilations
    const debounceCompile = () => {
      if (compileTimeout) {
        clearTimeout(compileTimeout)
      }
      compileTimeout = setTimeout(async () => {
        if (isCompiling || pendingChanges.size === 0) return

        pageCache.clear()

        isCompiling = true
        const start = process.hrtime()
        let dash = colours.gray(' ─ ')

        // Process all pending changes
        const changes = Array.from(pendingChanges)
        pendingChanges.clear()

        // Group changes by type
        const pagesChanges = changes.filter(p => p.startsWith(pagesPath))
        const templateChanges = changes.filter(p => p.startsWith(templatePath))
        const sassChanges = changes.filter(p => p.endsWith('.scss') || p.endsWith('.sass'))
        const cssChanges = changes.filter(p => p.endsWith('.css'))

        try {
          // Handle template changes
          for (const path of templateChanges) {
            await coralite.templates.setItem(path)
          }

          // Handle SASS changes - rebuild all SASS files once
          if (sassChanges.length > 0) {
            const results = await buildSass({
              input: config.styles.input,
              options: config.sassOptions,
              output: join(config.output, 'css'),
              start
            })

            for (const result of results) {
              process.stdout.write(toTime() + colours.bgGreen(' Compiled SASS ') + dash + toMS(result.duration) + dash + result.input + '\n')
            }
          }

          // Handle CSS changes - rebuild all CSS files once
          if (cssChanges.length > 0) {
            const results = await buildCSS({
              input: config.styles.input,
              output: join(config.output, 'css'),
              plugins: config.cssPlugins,
              start
            })

            for (const result of results) {
              process.stdout.write(toTime() + colours.bgGreen(' Compiled CSS ') + dash + toMS(result.duration) + dash + result.input + '\n')
            }
          }

          // Notify clients to reload
          if (pagesChanges.length > 0
            || templateChanges.length > 0
            || sassChanges.length > 0
            || cssChanges.length > 0) {
            clients.forEach(client => {
              client.write(`data: reload\n\n`)
            })
          }
        } catch (error) {
          displayError('Compilation failed', error)
        } finally {
          isCompiling = false
        }
      }, 100) // 100ms debounce
    }

    watcher
      .on('unlink', async (path) => {
        try {
          if (path.startsWith(templatePath)) {
            await coralite.templates.deleteItem(path)
          } else if (path.startsWith(pagesPath)) {
            await coralite.pages.deleteItem(path)
          }
        } catch (error) {
          displayError(`Failed to handle file deletion: ${path}`, error)
        }
      })
      .on('change', async (path) => {
        // Add to pending changes and trigger debounced compilation
        pendingChanges.add(path)
        debounceCompile()
      })
      .on('add', async (path) => {
        try {
          if (path.startsWith(templatePath)) {
            // set template item
            coralite.templates.setItem(path)
          } else if (path.endsWith('.scss') || path.endsWith('.sass')) {
            // Add to pending changes and trigger debounced compilation
            pendingChanges.add(path)
            debounceCompile()
          }
        } catch (error) {
          displayError(`Failed to handle file addition: ${path}`, error)
        }
      })
      .on('error', (error) => {
        displayError('File watcher error', error)
      })

    const port = await portfinder.getPortPromise({
      port: startPort,
      stopPort: startPort + 333
    })

    app.listen(port, () => {
      // @ts-ignore
      const access = localAccess({ port })
      const PAD = '  '
      const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)
      // print server status
      process.stdout.write('\n' + PAD + colours.green('Coralite is ready! 🚀\n\n'))
      process.stdout.write(PAD + `${colours.bold('- Local:')}      ${access.local}\n\n`)
      process.stdout.write(PAD + `${colours.bold('- Network:')}    ${access.network}\n\n`)
      process.stdout.write(border + colours.inverse(' LOGS ') + border + '\n\n')
    })
  } catch (error) {
    displayError('Failed to start server', error)
  }
}

export default server
