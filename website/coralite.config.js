import { defineConfig } from 'coralite-scripts'
import aggregation from 'coralite-plugin-aggregation'
import searchPlugin from './src/plugins/search-plugin.js'
import postcssImport from 'postcss-import'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
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
  },
  mode: 'development',
  plugins: [
    aggregation,
    searchPlugin
  ]
})
