# {{ name }}

A lightweight, isomorphic plugin for the [Coralite](https://coralite.dev) framework.

## Structure

- `src/index.js` - Plugin entry point exporting `definePlugin(...)`
- `tests/unit.spec.js` - Unit test suite verifying plugin hooks and context
- `tests/smoke.spec.js` - End-to-end smoke test compiling a sample Coralite site with the plugin
- `tests/fixtures/` - Test fixtures for components and pages

## Developing

```bash
# Run unit and smoke tests
npm test
```

## Plugin Architecture

Coralite plugins use `definePlugin` to extend the engine across build time (SSR) and the browser:

```javascript
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'my-plugin',

  config: {
    message: {
      type: String,
      default: 'Hello from Coralite Plugin!'
    }
  },

  /**
   * Top-level context is isomorphic and ubiquitous across
   * component and page server, getters, client, slots, and style.
   */
  context: ({ config }) => () => ({
    $plugin: {
      message: config.message
    }
  }),

  server: {
    /**
     * Called when a page file is loaded and processed during build time.
     */
    onPageSet ({ page, config }) {
      page.meta = page.meta || {}
      page.meta['x-plugin-powered'] = 'coralite-plugin'
    }
  }
})
```

## Deploying / Publishing

When you are ready to publish your plugin to npm:

```bash
npm publish --access public
```
