import { Coralite, staticAssetPlugin } from '../../lib/index.js'
import { testContextPlugin } from '../fixtures/plugins/test-context-plugin.js'

const coralite = new Coralite({
  components: 'tests/fixtures/components',
  pages: 'tests/fixtures/pages',
  output: '.coralite',
  mode: 'development',
  assets: [
    {
      src: 'package.json',
      dest: 'coralite.json'
    }
  ],
  plugins: [
    testContextPlugin,
    staticAssetPlugin([{
      src: 'package.json',
      dest: 'static-coralite.json'
    }])
  ],
  onError: (error) => {
    console.log(`[CORALITE-${error.level}]: ${error.message}`)
    if (error.level === 'ERR') {
      throw new Error(`[CORALITE-ERR]: ${error.message}`)
    }
  }
})

try {
  await coralite.initialise()
  await coralite.save()
  console.log('Coralite testing build HTML complete')
} catch (error) {
  console.error(error)
  process.exit(1)
}
