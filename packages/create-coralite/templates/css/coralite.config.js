import { defineConfig } from 'coralite-scripts'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  styles: {
    type: 'css',
    input: 'src/css'
  }
})
