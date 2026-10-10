import { defineConfig } from 'coralite-scripts'
import scopeProbePlugin from './src/plugins/scope-probe.js'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  plugins: [
    scopeProbePlugin
  ]
})
