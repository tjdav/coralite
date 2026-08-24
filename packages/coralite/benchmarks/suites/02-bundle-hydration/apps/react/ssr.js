import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { ProductCard } from './app.js'

/**
 * Renders the pre-rendered HTML document for SSR hydration benchmarking.
 * @returns {string} The pre-rendered HTML document string.
 */
export function renderHTML () {
  const content = ReactDOMServer.renderToString(React.createElement(ProductCard))
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>React 19 Benchmark</title>
</head>
<body>
  <div id="root">${content}</div>
  <script type="module" src="app.js"></script>
</body>
</html>`
}
