#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import express from 'express'
import colours from 'kleur'
import localAccess from 'local-access'
import chokidar from 'chokidar'
import loadConfig from '../src/load-config.js'
import buildSass from '../src/build-sass.js'
import { toCode, toMS, toTime } from '../src/build-utils.js'
import { extname, join } from 'path'
import { readFile, access, constants } from 'fs/promises'
import Coralite from 'coralite'

const config = await loadConfig()
const app = express()
const port = config.server?.port || 3000

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

// middleware to log request information including response time and status code
app.use(function (req, res, next){
  const start = process.hrtime()

  // when the response is finished, calculate duration and log details
  res.on('finish', function (){
    const dash = colours.gray(' ─ ')
    const duration = process.hrtime(start)
    const uri = req.originalUrl || req.url

    // log the response time and status code
    process.stdout.write(toTime() + toCode(res.statusCode) + dash + toMS(duration) + dash + uri + '\n')
  })
  next()
})

// check if Sass is configured and add its input directory to watchPath for file changes.
if (config.sass && config.sass.input) {
  watchPath.push(config.sass.input)

  app.use('/css', express.static(join(config.output, 'css'), {
    cacheControl: false
  }))
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
        const filePath = join(config.pages, path)

        try {

          // if that fails, try reading from pages directory.

          // check if page source file exists and is readable
          await access(filePath, constants.R_OK)
        } catch {
          res.sendStatus(404)
        }

        const start = process.hrtime()
        let duration, dash = colours.gray(' ─ ')

        await coralite.pages.setItem(filePath)
        // build the HTML for this page using the built-in compiler.
        const documents = await coralite.compile(path)
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
  persistent: true
})

let initWatcher = true

if (config.sass) {
  (async () => {
    const start = process.hrtime()
    let duration, dash = colours.gray(' ─ ')

    process.stdout.write(toTime() + colours.bgYellow('Compiling SASS...') + '\n')
    // rebuild CSS and send notification
    await buildSass({
      ...config.sass,
      output: join(config.output, 'css')
    })
    initWatcher = false
    // prints time and path to the file that has been changed or added.
    duration = process.hrtime(start)
    process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(duration) + dash + '\n')
  })()
}

watcher
  .on('change', async (path) => {
    const start = process.hrtime()
    let duration, dash = colours.gray(' ─ ')

    if (path.startsWith(config.templates)) {
      // update template file
      await coralite.templates.setItem(path)
    } else if (path.endsWith('.scss') || path.endsWith('.sass')) {
      // rebuild CSS and send notification
      await buildSass({
        ...config.sass,
        output: join(config.output, 'css')
      })

      // prints time and path to the file that has been changed or added.
      duration = process.hrtime(start)
      process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(duration) + dash + path + '\n')
    }

    clients.forEach(client => {
      client.write(`data: reload\n\n`)
    })
  })
  .on('add', async (path) => {
    if (!initWatcher && (path.endsWith('.scss') || path.endsWith('.sass'))) {
      const start = process.hrtime()
      let duration, dash = colours.gray(' ─ ')
      // rebuild CSS and send notification
      await buildSass({
        ...config.sass,
        output: join(config.output, 'css')
      })

      // prints time and path to the file that has been changed or added.
      duration = process.hrtime(start)
      process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(duration) + dash + path + '\n')
    }
  })

app.listen(port, () => {
  // @ts-ignore
  const { local } = localAccess({ port })
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)
  // print server status
  process.stdout.write('\n' + PAD + colours.green('Coralite is ready! 🚀\n\n'))
  process.stdout.write(PAD + `${colours.bold('- Local:')}      ${local}\n\n`)
  process.stdout.write(border + colours.inverse(' LOGS ') + border + '\n\n')
})
