import { defineConfig } from 'coralite-scripts'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  styles: {
    input: ['src/css/styles.css']
  }
})
