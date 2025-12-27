import express from 'express'
import colours from 'kleur'
import localAccess from 'local-access'
import chokidar from 'chokidar'
import buildSass from './build-sass.js'
import { toCode, toMS, toTime } from './build-utils.js'
import { extname, join, normalize } from 'path'
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
  const app = express()
  const startPort = config.server?.port && !isNaN(config.server.port) ? config.server.port : 3000

  // track active connections.
  const clients = new Set()

  // start coralite
  const coralite = new Coralite({
    templates: config.templates,
    pages: config.pages,
    plugins: config.plugins
  })
  await coralite.initialise()

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
  app.use(function (req, res, next){
    const start = process.hrtime()

    if (options.verbose) {
      // when the response is finished, calculate duration and log details
      res.on('finish', function (){
        const dash = colours.gray(' ─ ')
        const duration = process.hrtime(start)
        const uri = req.originalUrl || req.url

        // log the response time and status code
        process.stdout.write(toTime() + toCode(res.statusCode) + dash + toMS(duration) + dash + uri + '\n')
      })
    }

    next()
  })

  let initWatcher = true

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
      /** @TODO add a link to docs */
      throw new Error('Coralite config styles input must not be empty.')
    }

    if (config.styles.type === 'sass' || config.styles.type === 'scss') {
      const start = process.hrtime()

      // rebuild CSS and send notification
      const results = await buildSass({
        ...config.styles,
        output: join(config.output, 'css'),
        start
      })

      initWatcher = false
      let dash = colours.gray(' ─ ')

      for (let i = 0; i < results.length; i++) {
        const result = results[i]

        process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(result.duration) + dash + result.input + '\n')
      }
    } else if (config.styles.type === 'css') {
      const start = process.hrtime()

      await buildCSS({
        input: config.styles.input,
        output: join(config.output, 'css'),
        plugins: config.cssPlugins,
        start
      })

      initWatcher = false
    } else {
      /** @TODO add a link to docs */
      throw new Error('Coralite config styles type must not be empty')
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
      let path = req.path
      const extension = extname(path)

      // if no extension is present, assume it's a HTML file and append '.html'.
      if (!extension) {
        if ('/' === path) {
          path = 'index.html'
        } else if (path.endsWith('/')) {
          path = path.slice(0, path.length -1) + '.html'
        } else {
          path += '.html'
        }
      }

      try {
      // first attempt to read the file directly.
        await access(path)
        const data = await readFile(path, 'utf8')

        res.send(data)
      } catch {
        if (!path.endsWith('.html')) {
          res.sendStatus(404)
        } else {
          const pathname = join(config.pages, path)

          try {

            // if that fails, try reading from pages directory.

            // check if page source file exists and is readable
            await access(pathname, constants.R_OK)
          } catch {
            res.sendStatus(404)
          }

          const start = process.hrtime()
          let duration, dash = colours.gray(' ─ ')

          await coralite.pages.setItem(pathname)
          // build the HTML for this page using the built-in compiler.
          const documents = await coralite.compile(pathname)
          // inject a script to enable live reload via Server-Sent Events
          const injectedHtml = documents[0].html.replace(/<\/body>/i, `\n
  <script>
    const eventSource = new EventSource('/_/rebuild');
    eventSource.onmessage = function(event) {
      if (event.data === 'connected') return;
      // Reload page when file changes
      location.reload()
    }
  </script>
</body>`)

          // prints time and path to the file that has been changed or added.
          duration = process.hrtime(start)
          process.stdout.write(toTime() + colours.bgGreen('Compiled HTML') + dash + toMS(duration) + dash + path + '\n')
          res.send(injectedHtml)
        }
      }
    })

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
            process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(result.duration) + dash + result.input + '\n')
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
            process.stdout.write(toTime() + colours.bgGreen('Compiled CSS') + dash + toMS(result.duration) + dash + result.input + '\n')
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
      } finally {
        isCompiling = false
      }
    }, 100) // 100ms debounce
  }

  watcher
    .on('unlink', async (path) => {
      if (path.startsWith(templatePath)) {
        await coralite.templates.deleteItem(path)
      } else if (path.startsWith(pagesPath)) {
        await coralite.pages.deleteItem(path)
      }
    })
    .on('change', async (path) => {
      // Add to pending changes and trigger debounced compilation
      pendingChanges.add(path)
      debounceCompile()
    })
    .on('add', async (path) => {
      if (path.startsWith(templatePath)) {
        // set template item
        coralite.templates.setItem(path)
      } else if (path.endsWith('.scss') || path.endsWith('.sass')) {
        // Add to pending changes and trigger debounced compilation
        pendingChanges.add(path)
        debounceCompile()
      }
    })

  try {
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
    throw error
  }
}

export default server
