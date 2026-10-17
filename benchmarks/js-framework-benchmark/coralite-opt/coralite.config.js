import { defineConfig } from 'coralite'

export default defineConfig({
  output: 'dist',
  components: 'components',
  pages: 'pages',
  externalStyles: ['/css/currentStyle.css'],
  reconcile: 'minimal',
  compilerOptimizations: 'all'
})
