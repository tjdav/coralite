import { defineConfig } from 'coralite'
import { lists } from 'coralite/plugins/lists'

export default defineConfig({
  output: 'dist',
  components: 'components',
  pages: 'pages',
  base: './',
  baseURL: './',
  plugins: [lists()],
  externalStyles: ['/css/currentStyle.css']
})
