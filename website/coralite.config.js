import { defineConfig } from 'coralite'
import floatingPlugin from './src/plugins/floating-ui.js'
import sitemapPlugin from './src/plugins/sitemap.js'
import searchPlugin from './src/plugins/search.js'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333

const llmsFiles = [
  { file: 'llms.txt', priority: '0.7' },
  { file: 'llms-full.txt', priority: '0.5' },
  { file: 'llms/components.md', priority: '0.6' },
  { file: 'llms/serialization.md', priority: '0.6' },
  { file: 'llms/face.md', priority: '0.6' },
  { file: 'llms/css.md', priority: '0.6' },
  { file: 'llms/plugins.md', priority: '0.6' },
  { file: 'llms/diagnostics.md', priority: '0.6' },
  { file: 'llms/config.md', priority: '0.6' },
  { file: 'llms/testing.md', priority: '0.6' }
]

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  plugins: [
    floatingPlugin,
    sitemapPlugin({ customFiles: llmsFiles }),
    searchPlugin
  ],
  csp: {
    enabled: true,
    injectMeta: true,
    hashAlgorithm: 'sha256',
    externalStyles: true,
    directives: {
      'default-src': ["'self'"],
      // The Coralite client runtime revives serialized page controller
      // functions with new Function(), which requires 'unsafe-eval'.
      'script-src': ["'self'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"]
    }
  },
  server: {
    port
  },
  styles: {
    input: [
      'src/css/fonts.css',
      'src/css/main.css',
      'src/css/why.css',
      'src/css/home.css',
      'src/css/compare.css',
      'src/css/blog.css',
      'src/css/docs.css',
      'src/css/reference.css',
      'src/css/learn.css',
      'src/css/error.css',
      'src/css/code-theme.css'
    ]
  }
})
