import sirv from 'sirv'
import http from 'http'

const args = process.argv.slice(2)
const dirArg = args.find(arg => arg === '--dir')
const dir = dirArg ? args[args.indexOf(dirArg) + 1] : '.coralite'
const portArg = args.find(arg => arg === '--port')
const port = portArg ? parseInt(args[args.indexOf(portArg) + 1], 10) : 3862

const assets = sirv(dir, {
  dev: true,
  single: false,
  dotfiles: true
})

const server = http.createServer(assets)

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`)
  process.exit(1)
})

server.listen(port, () => {
  console.log(`> Ready on http://localhost:${port} (serving ${dir})`)
})
