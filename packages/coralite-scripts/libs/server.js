import express from 'express'
import colours from 'kleur'
import localAccess from 'local-access'
import chokidar from 'chokidar'
import buildStyles from './build-styles.js'
import { displayError, displayInfo, displayWarning, displaySuccess, toCode, toMS, toTime, deleteDirectoryRecursive } from './build-utils.js'
import { dirname, extname, join, normalize, relative, sep } from 'path'
import { access, constants, mkdir, readFile, writeFile } from 'fs/promises'
import { createCoralite } from 'coralite'
import { existsSync } from 'fs'
import portfinder from 'portfinder'

/**
 * @import {CoraliteScriptConfig, CoraliteScriptOptions} from '../types/index.js'
 */

/**
 * Resolves the requested path to a file or a virtual page.
 *
 * @param {string} reqPath - The requested URL path.
 * @param {string} extension - The extension of the requested path.
 * @param {CoraliteScriptConfig} config - The Coralite configuration.
 * @param {any} coralite - The Coralite instance.
 * @param {Map<string, string>} memoryPageSource - Map of in-memory page sources.
 * @returns {Promise<{pathname: string, key: string}|null>}
 */
export async function resolveSource (reqPath, extension, config, coralite, memoryPageSource) {
  const candidates = []
  const pagesRoot = normalize(config.pages)
  const isPathInsideRoot = (rootPath, candidatePath) => {
    const rel = relative(rootPath, candidatePath)
    return rel !== '..' && !rel.startsWith(`..${sep}`) && rel !== '' ? true : candidatePath === rootPath
  }

  // Ensure relative path doesn't start with / for joining
  const relPath = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath

  if (reqPath.endsWith('/')) {
    const key = join(relPath, 'index.html')
    const candidatePath = normalize(join(config.pages, key))

    if (isPathInsideRoot(pagesRoot, candidatePath)) {
      candidates.push({
        path: candidatePath,
        key
      })
    }
  } else if (extension === '.html') {
    const key = relPath
    const candidatePath = normalize(join(config.pages, key))

    if (isPathInsideRoot(pagesRoot, candidatePath)) {
      candidates.push({
        path: candidatePath,
        key
      })
    }
  } else {
    // No extension, no trailing slash
    const key1 = relPath + '.html'
    const candidatePath1 = normalize(join(config.pages, key1))

    if (isPathInsideRoot(pagesRoot, candidatePath1)) {
      candidates.push({
        path: candidatePath1,
        key: key1
      })
    }

    const key2 = join(relPath, 'index.html')
    const candidatePath2 = normalize(join(config.pages, key1))

    if (isPathInsideRoot(pagesRoot, candidatePath2)) {
      candidates.push({
        path: candidatePath2,
        key: key2
      })
    }
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

  // Fallback check coralite pages collection (supports virtual pages)
  for (const candidate of candidates) {
    const item = coralite.pages.getItem(candidate.path)

    if (item) {
      const normalizedKey = candidate.key.split(sep).join('/')
      return {
        pathname: candidate.path,
        key: normalizedKey
      }
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
    let coralite
    let currentConfig = config
    const pluginPaths = new Set()

    /**
     * Asynchronously extracts relative plugin paths from the `coralite.config.js` file.
     * This function clears the existing `pluginPaths` Set, reads the configuration file
     * (if it exists), and parses it line-by-line to find `import ... from '...'` statements.
     * Any relative paths found in these imports are resolved against the current working
     * directory and added to the `pluginPaths` Set.
     *
     * @returns {Promise<void>} A promise that resolves when the file has been processed.
     * Fails silently if the file does not exist or cannot be read.
     */
    const extractPluginPaths = async () => {
      pluginPaths.clear()

      try {
        const configPath = join(process.cwd(), 'coralite.config.js')

        try {
          await access(configPath, constants.F_OK)
        } catch {
          return
        }

        const configContent = await readFile(configPath, 'utf-8')
        const lines = configContent.split('\n')

        for (const line of lines) {
          if (line.trim().startsWith('import ') && line.includes(' from ')) {
            const match = line.match(/from\s+['"]([^'"]+)['"]/)
            if (match && match[1]) {
              const importPath = match[1]

              // If it's a relative path, resolve it
              if (importPath.startsWith('.')) {
                pluginPaths.add(join(process.cwd(), importPath))
              }
            }
          }
        }
      } catch {
        // ignore any other unexpected errors during reading/parsing
      }
    }

    let originalAppRouter
    /**
     * Asynchronously initializes or re-initializes the Coralite instance.
     * This function performs a complete setup/teardown cycle, making it suitable
     * for Hot Module Replacement (HMR) or development live-reloading. Its key operations include:
     * 1. Backing up the original Express application router state.
     * 2. Clearing the page cache.
     * 3. Creating and initializing a new `Coralite` instance with the current configuration.
     * 4. Resetting the Express router stack to remove stale plugin routes.
     * 5. Re-registering server-side plugin routes.
     * 6. Broadcasting a 'reload' signal to all connected clients via Server-Sent Events (SSE).
     *
     * @returns {Promise<void>} Resolves when the Coralite instance, plugins, and routing have been fully initialized.
     */
    const initCoralite = async () => {
      if (!originalAppRouter && app._router) {
        originalAppRouter = Object.assign({}, app._router)
        originalAppRouter.stack = [...app._router.stack]
      }
      displayInfo('Initializing Coralite...')

      pageCache.clear()

      coralite = await createCoralite({
        components: currentConfig.components,
        pages: currentConfig.pages,
        plugins: currentConfig.plugins,
        assets: currentConfig.assets,
        externalStyles: currentConfig.styles?.input?.map(input => {
          const ext = input.split('.').pop()
          return '/assets/css/' + input.split('/').pop().replace(`.${ext}`, '.css')
        }),
        baseURL: currentConfig.baseURL,
        ignoreByAttribute: currentConfig.ignoreByAttribute,
        skipRenderByAttribute: currentConfig.skipRenderByAttribute,
        mode: 'development',
        output: currentConfig.output,
        onError: ({ level, message, error }) => {
          if (level === 'ERR') {
            displayError(message, error)
          } else if (level === 'WARN') {
            displayWarning(message)
          } else {
            displayInfo(message)
          }
        }
      })


      displaySuccess('Coralite initialized successfully')

      // Reset express routing to remove old plugin routes before adding new ones
      if (originalAppRouter && originalAppRouter.stack) {
        // Splice the router stack back to its original length to remove newly added routes
        app._router.stack.splice(originalAppRouter.stack.length)
      }

      if (currentConfig.plugins) {
        await extractPluginPaths()

        for (const plugin of currentConfig.plugins) {
          if (typeof plugin.server === 'function') {
            // @ts-ignore
            await plugin.server(app, coralite)
          }
        }
      }

      clients.forEach(client => {
        client.write(`data: reload\n\n`)
      })
    }

    await initCoralite()

    const watchPath = [
      process.cwd() + '/coralite.config.js',
      config.public,
      config.pages,
      config.components
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
      if (options.verbose) {
        const start = process.hrtime()
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

    const staticOptions = {
      cacheControl: false,
      setHeaders: (res, path) => {
        if (path.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
        }
      }
    }

    // serve compiled components directory
    app.use(express.static(config.output, staticOptions))

    // check if styles are configured and add its inputs to watchPath for file changes.
    if (config.styles && config.styles.input) {
      for (const input of config.styles.input) {
        watchPath.push(dirname(input))
      }

      app.use('/assets/css', express.static(join(config.output, 'assets', 'css'), {
        cacheControl: false
      }))

      // rebuild CSS and send notification
      const results = await buildStyles({
        input: config.styles.input,
        output: join(config.output, 'assets', 'css'),
        processors: config.styles.processors
      })

      const dash = colours.gray(' ─ ')

      for (let i = 0; i < results.length; i++) {
        const result = results[i]

        process.stdout.write(toTime() + colours.bgGreen(' Compiled STYLES ') + dash + toMS(result.duration) + dash + result.input + '\n')
      }
    }

    app
      .use(express.static(config.public, staticOptions))
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

        const result = await resolveSource(reqPath, extension, config, coralite, memoryPageSource)

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

          // Only set item if it's not already in the collection (virtual pages are pre-registered)
          const item = coralite.pages.getItem(pathname)

          if (!item || item.virtual !== true) {
            await coralite.pages.setItem(pathname)
          }

          // build the HTML for this page using the built-in compiler.
          const documents = await coralite.build(pathname, async (result) => {
            // inject a script to enable live reload via Server-Sent Events
            const injectedHtml = result.content.replace(/<\/body>/i, rebuildScript)

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
              content: injectedHtml,
              duration: result.duration
            }
          })

          // Write ESM script assets generated during the build phase
          if (coralite.outputFiles) {
            const assetsDir = join(config.output, 'assets', 'js')

            if (!existsSync(assetsDir)) {
              await mkdir(assetsDir, { recursive: true })
            }

            const assetWrites = Object.values(coralite.outputFiles).map(async (file) => {
              const outFile = join(assetsDir, file.hashedPath)
              await writeFile(outFile, file.text)
            })

            await Promise.all(assetWrites)
          }

          // prints time and path to the file that has been changed or added.
          duration = process.hrtime(start)
          process.stdout.write(toTime() + colours.bgGreen(' Compiled HTML ') + dash + toMS(duration) + dash + '/' + cacheKey + '\n')

          // find the document that matches the request path
          const doc = documents.find(doc => {
            if (!doc) {
              return false
            }
            const relPath = relative(config.pages, doc.path.pathname)
            const normalizedKey = relPath.split(sep).join('/')
            return normalizedKey === cacheKey
          })

          if (doc) {
            res.send(doc.content)
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

    const componentPath = normalize(config.components)
    const pagesPath = normalize(config.pages)

    // Debouncing and compilation state management
    let compileTimeout = null
    let isCompiling = false
    const pendingChanges = new Set()
    const configPathStr = join(process.cwd(), 'coralite.config.js')


    // Helper function to debounce compilations
    const debounceCompile = () => {
      if (compileTimeout) {
        // @ts-ignore
        clearTimeout(compileTimeout)
      }
      compileTimeout = setTimeout(async () => {
        if (isCompiling || pendingChanges.size === 0) {
          return
        }

        pageCache.clear()

        isCompiling = true
        let dash = colours.gray(' ─ ')

        // Process all pending changes
        const changes = Array.from(pendingChanges)
        pendingChanges.clear()

        // Group changes by type
        const pagesChanges = changes.filter(p => p.startsWith(pagesPath))
        const componentChanges = changes.filter(p => p.startsWith(componentPath))
        const stylesChanges = changes.filter(p => {
          if (!currentConfig.styles?.input) {
            return false
          }
          return currentConfig.styles.input.some(input => p.startsWith(normalize(join(process.cwd(), dirname(input))))) || p.endsWith('.scss') || p.endsWith('.sass') || p.endsWith('.css')
        })
        const configChanges = changes.filter(p => p === configPathStr || Array.from(pluginPaths).some(pluginPath => p === pluginPath))

        try {
          // Handle config changes
          if (configChanges.length > 0) {
            displayInfo('Configuration changed, reloading Coralite...')
            // Append cache busting param to reload properly
            const { pathToFileURL } = await import('url')
            const bust = '?t=' + Date.now()

            try {
              const freshConfigModule = await import(pathToFileURL(configPathStr).toString() + bust)
              const { defineConfig } = await import('./config.js')

              if (freshConfigModule.default) {
                currentConfig = defineConfig(freshConfigModule.default)
                currentConfig.output = config.output
                currentConfig.server = config.server

                // Re-initialize Coralite with new config
                await initCoralite()
              }
            } catch (err) {
              displayError('Failed to reload configuration', err)
            }
          }

          // Handle component changes
          for (const path of componentChanges) {
            await coralite.components.setItem(path)
          }

          // Handle STYLES changes - rebuild all STYLES files once
          if (stylesChanges.length > 0 && currentConfig.styles?.input) {
            const results = await buildStyles({
              input: currentConfig.styles.input,
              processors: currentConfig.styles.processors,
              output: join(config.output, 'assets', 'css')
            })

            for (const result of results) {
              process.stdout.write(toTime() + colours.bgGreen(' Compiled STYLES ') + dash + toMS(result.duration) + dash + result.input + '\n')
            }
          }

          // Notify clients to reload
          if (pagesChanges.length > 0
            || componentChanges.length > 0
            || stylesChanges.length > 0
            || configChanges.length > 0) {
            clients.forEach(client => {
              client.write(`data: reload\n\n`)
            })
          }
        } catch (error) {
          displayError('Compilation failed', error)
        } finally {
          isCompiling = false
        }
      }, 100)
    }

    watcher
      .on('unlink', async (path) => {
        try {
          if (path.startsWith(componentPath)) {
            await coralite.components.deleteItem(path)
          } else if (path.startsWith(pagesPath)) {
            await coralite.pages.deleteItem(path)
          }
        } catch (error) {
          displayError(`Failed to handle file deletion: ${path}`, error)
        }
      })
      .on('change', async (path) => {
        // We only want to trigger for things we care about or are in watchPath (but sometimes chokidar watches the whole dir)
        pendingChanges.add(path)
        debounceCompile()
      })
      .on('add', async (path) => {
        try {
          if (path.startsWith(componentPath)) {
            // set component item
            coralite.components.setItem(path)
          } else if (path.endsWith('.scss') || path.endsWith('.sass') || path === configPathStr || Array.from(pluginPaths).some(pluginPath => path === pluginPath)) {
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

    const gracefulShutdown = () => {
      deleteDirectoryRecursive(config.output)
      process.exit(0)
    }

    process.on('SIGINT', gracefulShutdown)
    process.on('SIGTERM', gracefulShutdown)
  } catch (error) {
    displayError('Failed to start server', error)
  }
}

export default server
