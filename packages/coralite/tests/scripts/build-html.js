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

/**
 * Fixtures that intentionally fail to build — the failure IS the test.
 * Each entry is a page path relative to tests/fixtures/pages/, with the
 * `.html` or `/index.html` suffix stripped.
 *
 * Organized by category. If a fixture in this list starts passing, the
 * build will warn about a stale entry — remove it from this list.
 *
 * Adding a new test that intentionally fails to build? Add it here.
 */
const EXPECTED_BUILD_FAILURES = new Set([
  // Error-boundary tests: fixture server() or getters intentionally throw
  'no-on-error',
  'on-error-string',
  'on-error-getter-throws',
  'on-error-template-state',
  'on-error-throws',
  'on-error-void',
  'redirect/invalid-status',
  'redirect/invalid-to',
  'multi-path/error-handling/fail',

  // Path-validation tests: fixture paths() intentionally throws or returns invalid shape
  'with-paths-invalid',
  'with-paths-throwing',
  'with-paths',
  'with-define-page',
  'route-serialization',
  'with-paths-async',
  'codemod/expected-both',
  'codemod/expected-paths-only',
  // Codemod output tests: expected transform artifacts, not runnable pages
  'codemod/expected-with-imports',
  'dedup/cross-source-duplicate',
  'dedup/same-source-duplicate',

  // Bare-export tests: fixture intentionally uses deprecated page export shape
  'bare-exports',
  'codemod/before-ignore-pragma',

  // Validator tests: fixture intentionally triggers CORALITE-E401
  'server-with-headers'
])

/**
 * Normalize a failed-page path to a comparable key.
 * - 'tests/fixtures/pages/on-error-string/index.html' → 'on-error-string'
 * - 'tests/fixtures/pages/bare-exports.html' → 'bare-exports'
 * - 'tests/fixtures/pages/codemod/expected-both.html' → 'codemod/expected-both'
 *
 * Adapt to the actual shape of p.path in failedPages (Phase 0 Q1).
 */
function normalizeFailedPageKey (pathOrData) {
  const raw = typeof pathOrData === 'string' ? pathOrData : (pathOrData.pathname ?? pathOrData.path ?? '')
  return raw
    .replace(/^tests\/fixtures\/pages\//, '')
    .replace(/(\/index)?\.html$/, '')
}

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
} catch (err) {
  if (!err.failedPages || !Array.isArray(err.failedPages)) {
    // Not a page-failure error — re-throw immediately
    throw err
  }

  const expectedFailures = []
  const realFailures = []
  for (const page of err.failedPages) {
    const key = normalizeFailedPageKey(page.path)
    if (EXPECTED_BUILD_FAILURES.has(key)) {
      expectedFailures.push({
        key,
        page
      })
    } else {
      realFailures.push({
        key,
        page
      })
    }
  }

  // Stale-manifest detection: manifest entries not present in failures
  const failedKeys = new Set(err.failedPages.map(p => normalizeFailedPageKey(p.path)))
  const staleEntries = [...EXPECTED_BUILD_FAILURES].filter(k => !failedKeys.has(k))

  if (staleEntries.length > 0) {
    console.warn(`[CORALITE-WARN] Expected-failure manifest has ${staleEntries.length} stale entries (fixtures now pass):`)
    for (const entry of staleEntries) {
      console.warn(`  - ${entry}  (remove from EXPECTED_BUILD_FAILURES)`)
    }
  }

  if (expectedFailures.length > 0) {
    console.log(`[CORALITE-INFO] ${expectedFailures.length} expected failure(s) — see EXPECTED_BUILD_FAILURES manifest:`)
    for (const { key } of expectedFailures) {
      console.log(`  ✓ ${key}`)
    }
  }

  if (realFailures.length > 0) {
    console.error(`[CORALITE-ERR] Build failed with ${realFailures.length} unexpected page(s):`)
    for (const { key, page } of realFailures) {
      const msg = page.error?.message ?? String(page.error)
      console.error(`  ✗ ${key}: ${msg}`)
    }
    console.error(`\n${realFailures.length} unexpected failure(s). Fix or add to EXPECTED_BUILD_FAILURES if intentional.`)
    throw err
  }

  console.log(`\n[CORALITE-INFO] Build completed with ${expectedFailures.length} expected failure(s), 0 unexpected.`)
}

const listsApp = await createCoralite({
  components: 'tests/fixtures/lists-app/components',
  pages: 'tests/fixtures/lists-app/pages',
  output: `${output}/lists-app`,
  baseURL: '/lists-app/',
  mode,
  cleanUrls: true
})

try {
  await listsApp.save()
  console.log(`Coralite lists-app build HTML complete (mode: ${mode}, output: ${output}/lists-app)`)
} catch (error) {
  console.error(error)
  process.exit(1)
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
