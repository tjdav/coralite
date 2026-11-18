import { readFileSync } from 'node:fs'
import { definePlugin } from 'coralite'

// The site is a workspace package, so the coralite dependency resolves to the
// package being documented. Reading it here keeps the displayed version tied
// to the release that built the site.
const { version } = JSON.parse(
  readFileSync(new URL('../../node_modules/coralite/package.json', import.meta.url), 'utf8')
)

export default definePlugin({
  name: '$version',
  server: {
    // Build-time constant: server context keeps it out of the browser bundle.
    context: () => () => version
  }
})
