#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import express from 'express'
import colours from 'kleur'
import localAccess from 'local-access'
import chokidar from 'chokidar'
import loadConfig from '../src/load-config.js'
import html from '../src/build-html.js'
import buildSass from '../src/build-sass.js'
import { toMS, toTime } from '../src/build-utils.js'
import { extname, join } from 'path'
import { readFile, access, constants } from 'fs/promises'

const config = await loadConfig()
const app = express()
const port = config.server?.port || 3000
// track active connections.
const clients = new Set()

const buildHTML = await html(config)

app
  .use('/assets', express.static(config.assets, {
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
    let path = req.path
    const extension = extname(path)

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
      await access(path)
      const data = await readFile(path, 'utf8')

      res.send(data)
    } catch {
      try {
        const filePath = join(config.pages, path)

        // check if page src file exists
        await access(filePath, constants.R_OK)
        const start = process.hrtime()
        let duration, dash = colours.gray(' ─ ')
        // build page
        await buildHTML.compile(filePath)

        const data = await readFile(filePath, 'utf8')
        // inject the script before </body>
        const injectedHtml = data.replace(/<\/body>/i, `
<script>
  const eventSource = new EventSource('/_/rebuild');
  eventSource.onmessage = function(event) {
  if (event.data === 'connected') return;
    // Reload page when file changes
    location.reload()
  }
  eventSource.onerror = function(err) {
  console.error('SSE error:', err);
}
</script>
</body>`)

        // prints time and path to the file that has been changed or added.
        duration = process.hrtime(start)
        process.stdout.write(toTime() + colours.bgGreen('Compiled HTML') + dash + toMS(duration) + dash + path + '\n')
        res.send(injectedHtml)
      } catch(error) {
        res.sendStatus(404)
      }
    }
  })


const watchPath = [
  config.assets,
  config.pages,
  config.templates
]

if (config.sass && config.sass.input && config.sass.output) {
  watchPath.push(config.sass.input)
}

// watch for file changes
const watcher = chokidar.watch(watchPath, {
  persistent: true
})

watcher
  .on('change', async (path) => {
    if (path.endsWith('.scss') || path.endsWith('.sass')) {
      const start = process.hrtime()
      let duration, dash = colours.gray(' ─ ')
      // rebuild CSS and send notification
      await buildSass(config.sass)

      // prints time and path to the file that has been changed or added.
      duration = process.hrtime(start)
      process.stdout.write(toTime() + colours.bgGreen('Compiled SASS') + dash + toMS(duration) + dash + path + '\n')
    }

    clients.forEach(client => {
      client.write(`data: reload\n\n`)
    })
  })
  .on('add', async (path) => {
    if (path.endsWith('.scss') || path.endsWith('.sass')) {
      const start = process.hrtime()
      let duration, dash = colours.gray(' ─ ')
      // rebuild CSS and send notification
      await buildSass(config.sass)

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
