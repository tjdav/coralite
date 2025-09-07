import { defineConfig } from 'coralite-scripts'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  templates: 'src/templates',
  sass: {
    input: 'src/scss'
  }
})
