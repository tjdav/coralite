import { defineConfig } from 'coralite-scripts'
import aggregation from 'coralite-plugin-aggregation'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  templates: 'src/templates',
  styles: {
    type: 'css',
    input: 'src/css'
  },
  plugins: [aggregation]
})
