import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { ProductCard } from './app.js'

/**
 * Renders the pre-rendered HTML document for SSR hydration benchmarking.
 * @returns {Promise<string>} The pre-rendered HTML document string.
 */
export async function renderHTML () {
  const app = createSSRApp(ProductCard)
  const content = await renderToString(app)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vue 3 Benchmark</title>
</head>
<body>
  <div id="app">${content}</div>
  <script type="module" src="app.js"></script>
</body>
</html>`
}
