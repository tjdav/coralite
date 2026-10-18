import { createCoralite } from '../../lib/index.js'
import { staticAssetPlugin, testingPlugin } from '../../plugins/index.js'
import { testContextPlugin } from '../fixtures/plugins/test-context-plugin.js'
import { mockPlugin } from '../fixtures/plugins/mock-plugin.js'
import { providerPlugin } from '../fixtures/plugins/provider-plugin.js'
import { observerPlugin } from '../fixtures/plugins/observer-plugin.js'
import { consumerServerPlugin } from '../fixtures/plugins/consumer-server-plugin.js'
import { consumerClientPlugin } from '../fixtures/plugins/consumer-client-plugin.js'
import { hookTestPlugin } from '../fixtures/plugins/hook-test-plugin.js'
import { configTypesPlugin } from '../fixtures/plugins/config-types-plugin.js'

const args = process.argv.slice(2)
const modeArg = args.find(arg => arg === '--mode')
const mode = modeArg ? args[args.indexOf(modeArg) + 1] : 'development'
const outDirArg = args.find(arg => arg === '--outDir')
const output = outDirArg ? args[args.indexOf(outDirArg) + 1] : '.coralite'

const coralite = await createCoralite({
  components: 'tests/fixtures/components',
  pages: 'tests/fixtures/pages',
  output,
  mode,
  assets: [
    {
      src: 'package.json',
      dest: 'coralite.json'
    }
  ],
  plugins: [
    testingPlugin,
    testContextPlugin,
    mockPlugin,
    staticAssetPlugin([{
      src: 'package.json',
      dest: 'static-coralite.json'
    }]),
    providerPlugin,
    observerPlugin,
    consumerServerPlugin,
    consumerClientPlugin,
    hookTestPlugin,
    configTypesPlugin,
    {
      name: 'my-plugin',
      server: {
        context: () => {
          return () => ({
            myFunc: () => 'secret'
          })
        }
      }
    }
  ],
  onError: (error) => {
    console.log(`[CORALITE-${error.level}]: ${error.message}`)
    if (error.level === 'ERR') {
      if (
        error.message.includes('bare-export') ||
        error.message.includes('definePage does not support') ||
        error.message.includes('Malformed dynamic segment') ||
        error.message.includes('has more than one <script type="module"> block') ||
        (error.filePath && (error.filePath.includes('rejected-block') || error.filePath.includes('bare-exports') || error.filePath.includes('unknown-block') || error.filePath.includes('error-handling') || error.filePath.includes('patterns') || error.filePath.includes('script-both-places')))
      ) {
        return
      }
      throw new Error(`[CORALITE-ERR]: ${error.message}`)
    }
  }
})

try {
  await coralite.save()
  console.log(`Coralite testing build HTML complete (mode: ${mode}, output: ${output})`)
} catch (error) {
  if ((error.pagePath && error.pagePath.includes('error-handling')) || (error.message && error.message.includes('Exact route collision detected'))) {
    console.log('Ignoring expected error in test fixtures build:', error.message)
  } else {
    console.error(error)
    process.exit(1)
  }
}

let routerAppOutDir = '.coralite-router-dev'
if (mode === 'production') {
  routerAppOutDir = '.coralite-router-prod'
} else if (mode === 'testing') {
  routerAppOutDir = '.coralite-router-testing'
}

const routerApp = await createCoralite({
  components: 'tests/fixtures/router-app/components',
  pages: 'tests/fixtures/router-app/pages',
  output: routerAppOutDir,
  mode,
  cleanUrls: true
})

try {
  await routerApp.save()
  console.log(`Coralite router-app build HTML complete (mode: ${mode}, output: ${routerAppOutDir})`)
} catch (error) {
  console.error(error)
  process.exit(1)
}
