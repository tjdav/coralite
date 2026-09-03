import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import createCoralite from '../../lib/coralite.js'

function normalizeTimestamp (html) {
  if (typeof html !== 'string') return html
  return html.replace(/\d{13}/g, '1700000000000')
}

async function runParityCheck () {
  console.log('Running Fragment-Op Parity Verification Harness...')
  const tempDir = await mkdtemp(join(tmpdir(), 'coralite-parity-'))

  const componentsDir = join(tempDir, 'components')
  const pagesDir = join(tempDir, 'pages')

  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(componentsDir, { recursive: true })
  await mkdir(pagesDir, { recursive: true })

  // Write nested card component
  await writeFile(join(componentsDir, 'nested-card.html'), `
<template id="nested-card">
  <div class="nested-card">
    <span class="card-title">{{ title }}</span>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Default Card' }
    }
  })
</script>
`)

  // Write user profile component containing nested card
  await writeFile(join(componentsDir, 'user-profile.html'), `
<template id="user-profile">
  <div class="user-profile">
    <h2>User: {{ username }}</h2>
    <nested-card title="{{ cardTitle }}"></nested-card>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      username: { type: String, default: 'Anonymous' }
    },
    getters: {
      cardTitle({ state }) {
        return 'Card for ' + state.username
      }
    }
  })
</script>
`)

  // Write 100 pages using nested components
  const PAGE_COUNT = 100
  for (let i = 0; i < PAGE_COUNT; i++) {
    await writeFile(join(pagesDir, `page-${i}.html`), `
<!DOCTYPE html>
<html>
  <head><title>Page ${i}</title></head>
  <body>
    <h1>Profile ${i}</h1>
    <user-profile username="User ${i}"></user-profile>
  </body>
</html>
`)
  }

  try {
    const options = {
      components: componentsDir,
      pages: pagesDir,
      mode: 'production',
      incremental: false
    }

    const fastApp = await createCoralite(options)
    const fastResults = await fastApp.build()

    // Assert structural capability on fastApp components
    for (const comp of fastApp.components.list) {
      assert(comp.result.__opsCapable === true, `Component ${comp.result.id} is not opsCapable`)
      assert(Array.isArray(comp.result._ops), `Component ${comp.result.id} does not have _ops array`)
    }

    // Assert runtime telemetry dispatches on fastApp
    let totalFastDispatches = 0
    let totalLegacyDispatches = 0
    for (const res of fastResults) {
      totalFastDispatches += res.session?._fragFast || 0
      totalLegacyDispatches += res.session?._fragLegacy || 0
    }

    assert(totalFastDispatches === PAGE_COUNT * 2, `Expected ${PAGE_COUNT * 2} fast dispatches, got ${totalFastDispatches}`)
    assert(totalLegacyDispatches === 0, `Expected 0 legacy dispatches in fast build, got ${totalLegacyDispatches}`)

    const legacyApp = await createCoralite({
      ...options,
      plugins: [
        {
          name: 'force-legacy-plugin',
          server: {
            onBeforeComponentRender ({ state }) {
              return state
            }
          }
        }
      ]
    })
    const legacyResults = await legacyApp.build()

    let legacyFastDispatches = 0
    let legacyLegacyDispatches = 0
    for (const res of legacyResults) {
      legacyFastDispatches += res.session?._fragFast || 0
      legacyLegacyDispatches += res.session?._fragLegacy || 0
    }

    assert(legacyFastDispatches === 0, `Expected 0 fast dispatches in legacy build, got ${legacyFastDispatches}`)
    assert(legacyLegacyDispatches === PAGE_COUNT * 2, `Expected ${PAGE_COUNT * 2} legacy dispatches in legacy build, got ${legacyLegacyDispatches}`)

    assert(fastResults.length === legacyResults.length, `Result length mismatch: ${fastResults.length} vs ${legacyResults.length}`)

    let mismatches = 0
    for (let i = 0; i < fastResults.length; i++) {
      const fast = fastResults[i]
      const legacy = legacyResults.find(r => r.path.pathname === fast.path.pathname)

      if (!legacy) {
        console.error(`[Parity Mismatch] Page ${fast.path.pathname} missing in legacy results!`)
        mismatches++
        continue
      }

      const fastHTML = normalizeTimestamp(fast.content)
      const legacyHTML = normalizeTimestamp(legacy.content)

      if (fastHTML !== legacyHTML) {
        for (let j = 0; j < Math.max(fastHTML.length, legacyHTML.length); j++) {
          if (fastHTML[j] !== legacyHTML[j]) {
            console.error(`[Diff at index ${j}]\nFAST slice: ${JSON.stringify(fastHTML.slice(Math.max(0, j - 20), j + 40))}\nLEGACY slice: ${JSON.stringify(legacyHTML.slice(Math.max(0, j - 20), j + 40))}`)
            break
          }
        }
        mismatches++
        break
      }

      const fastCounters = JSON.stringify(fast.session?.instanceCounters || {})
      const legacyCounters = JSON.stringify(legacy.session?.instanceCounters || {})

      if (fastCounters !== legacyCounters) {
        console.error(`[Parity Mismatch] Page ${fast.path.pathname}: Instance counter sequencing differs! Fast: ${fastCounters}, Legacy: ${legacyCounters}`)
        mismatches++
      }

      const fastScripts = JSON.stringify(fast.session?.scripts?.content || {})
      const legacyScripts = JSON.stringify(legacy.session?.scripts?.content || {})

      if (fastScripts !== legacyScripts) {
        console.error(`[Parity Mismatch] Page ${fast.path.pathname}: Hydration scripts content differs!`)
        mismatches++
      }
    }

    if (mismatches > 0) {
      console.error(`Parity check failed with ${mismatches} mismatches.`)
      process.exit(1)
    }

    console.log(`Parity Verification Success! 100% byte-identical parity across ${PAGE_COUNT} pages.`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function assert (condition, message) {
  if (!condition) {
    console.error(`[Parity Check Error] ${message}`)
    process.exit(1)
  }
}

runParityCheck().catch((err) => {
  console.error('Unhandled error in parity check harness:', err)
  process.exit(1)
})
