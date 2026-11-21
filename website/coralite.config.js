import { defineConfig } from 'coralite'
import postcssImport from 'postcss-import'
import autoprefixer from 'autoprefixer'
import floatingPlugin from './src/plugins/floating-ui.js'
import sitemapPlugin from './src/plugins/sitemap.js'
import searchPlugin from './src/plugins/search.js'
import changelogPlugin from './src/plugins/changelog.js'
import diagnosticsPlugin from './src/plugins/diagnostics.js'
import ogImagesPlugin from './src/plugins/og-images.js'
import siteVersionPlugin from './src/plugins/site-version.js'
import goatCounterPlugin from './src/plugins/goatcounter.js'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333

const llmsFiles = [
  {
    file: 'llms.txt',
    priority: '0.7'
  },
  {
    file: 'llms-full.txt',
    priority: '0.5'
  },
  {
    file: 'llms/components.md',
    priority: '0.6'
  },
  {
    file: 'llms/serialization.md',
    priority: '0.6'
  },
  {
    file: 'llms/face.md',
    priority: '0.6'
  },
  {
    file: 'llms/css.md',
    priority: '0.6'
  },
  {
    file: 'llms/plugins.md',
    priority: '0.6'
  },
  {
    file: 'llms/diagnostics.md',
    priority: '0.6'
  },
  {
    file: 'llms/config.md',
    priority: '0.6'
  },
  {
    file: 'llms/testing.md',
    priority: '0.6'
  }
]

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  plugins: [
    siteVersionPlugin,
    floatingPlugin,
    changelogPlugin,
    sitemapPlugin({ customFiles: llmsFiles }),
    searchPlugin,
    diagnosticsPlugin,
    ogImagesPlugin,
    goatCounterPlugin({ site: 'https://stats.coralite.dev' })
  ],
  csp: {
    enabled: true,
    injectMeta: true,
    hashAlgorithm: 'sha256',
    // Inline the per-page component CSS so a second stylesheet never blocks
    // first paint. `style-src` already allows 'unsafe-inline', so the hash is
    // omitted and authored style attributes keep working.
    externalStyles: false,
    directives: {
      'default-src': ["'self'"],
      // The Coralite client runtime revives serialized page controller
      // functions with new Function(), which requires 'unsafe-eval'.
      'script-src': ["'self'", "'unsafe-eval'", 'https://stats.coralite.dev'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https://stats.coralite.dev'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", 'https://stats.coralite.dev']
    }
  },
  server: {
    port
  },
  styles: {
    input: ['src/css/styles.css'],
    processors: {
      postcss: {
        plugins: [
          postcssImport(),
          autoprefixer()
        ]
      }
    }
  }
})
