import { defineConfig } from 'coralite-scripts'
import aggregation from 'coralite-plugin-aggregation'
import inlineCSS from 'coralite-plugin-inline-css'
import searchPlugin from './src/plugins/search-plugin.js'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  styles: {
    type: 'css',
    input: 'src/css'
  },
  mode: 'development',
  plugins: [
    aggregation,
    inlineCSS({
      atImport: true,
      minify: true,
      path: 'src'
    }),
    searchPlugin
  ]
})
