import { compile } from 'svelte/compiler'
import { render } from 'svelte/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Renders the pre-rendered HTML document for Svelte 5 SSR hydration benchmarking.
 * @returns {Promise<string>} The pre-rendered HTML document string.
 */
export async function renderHTML () {
  const svelteFilePath = path.join(__dirname, 'ProductCard.svelte')
  const svelteCode = fs.readFileSync(svelteFilePath, 'utf-8')

  const compiled = compile(svelteCode, {
    generate: 'server',
    filename: svelteFilePath,
    runes: true
  })

  // Create temporary compiled JS module for SSR rendering
  const tmpPath = path.join(__dirname, '.ProductCard.server.js')
  fs.writeFileSync(tmpPath, compiled.js.code, 'utf-8')

  let content = ''
  try {
    const mod = await import(`${pathToFileURL(tmpPath).href}?t=${Date.now()}`)
    const Component = mod.default
    const result = render(Component)
    content = result.html
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Svelte 5 Benchmark</title>
</head>
<body>
  <div id="root">${content}</div>
  <script type="module" src="app.js"></script>
</body>
</html>`
}
