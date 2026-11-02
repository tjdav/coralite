# Coralite Configuration Reference

> Configuration schema and options for `coralite.config.js`.

## 1. Minimal Setup

Author configuration using `export default defineConfig({ ... })` imported from `'coralite'`:

```javascript
import { defineConfig } from 'coralite'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components'
})
```

## 2. Full Options Reference

```javascript
import { defineConfig } from 'coralite'
import sitemapPlugin from './plugins/sitemap.js'

export default defineConfig({
  // Root directories
  public: 'public',             // Static assets directory copied to output
  output: 'dist',               // Production output directory
  pages: 'src/pages',           // HTML route files
  components: 'src/components', // Custom element HTML files

  // Build & Server Options
  mode: 'production',           // 'development' | 'production' | 'testing'
  cleanUrls: true,              // Emits clean folder URLs (/about/index.html instead of /about.html)
  sourceMaps: false,            // Enable JS/CSS source maps

  // Content Security Policy
  csp: {
    enabled: true,
    injectMeta: true,
    hashAlgorithm: 'sha256',
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://esm.sh'],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:']
    }
  },

  // Test fixtures & exclusions
  fixtures: 'tests/fixtures',   // Directory containing test fixture pages (or { pages, components, prefix })
  exclude: ['**/drafts/**'],    // Custom glob patterns excluded from page discovery

  // Styles processing
  styles: {
    input: ['src/css/styles.css'],
    processors: {
      postcss: {
        plugins: []
      }
    }
  },

  // Plugins
  plugins: [
    sitemapPlugin()
  ]
})
```

## 3. Test Fixtures & Page Exclusions

- `fixtures: 'tests/fixtures'` isolates component test fixtures outside `src/pages/`.
- In `coralite dev` and `coralite test`, fixtures are served under `/__fixtures__/<name>`.
- In `coralite build`, fixtures and test directories (`__test__`, `__tests__`, `*.test.html`, `*.spec.html`, `*.fixture.html`) are strictly excluded and never emitted to `dist/`.
