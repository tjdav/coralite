import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('lazy dependency stylesheets via dynamic import()', () => {
  let testDir
  let componentsDir
  let pagesDir
  let outputDir

  const writePackage = async (name, files) => {
    const root = join(testDir, 'node_modules', name)
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({
      name,
      version: '1.0.0'
    }))

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = join(root, relativePath)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content)
    }
  }

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-lazy-stylesheets-'))
    componentsDir = join(testDir, 'components')
    pagesDir = join(testDir, 'pages')
    outputDir = join(testDir, 'dist')

    await mkdir(componentsDir, { recursive: true })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    await writePackage('acme-styles', {
      'dist/base.css': '.base { color: red; }\n',
      'dist/acme.css': '@import "./base.css";\n.acme-map { background-image: url("./images/marker.png"); }\n',
      'dist/images/marker.png': Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]),
      'dist/print.css': '.print-only { display: block; }\n',
      'dist/other.css': '.other { color: blue; }\n'
    })
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  it('builds a dynamically imported bare-package stylesheet in client() as a hashed lazy asset', async () => {
    await writeFile(join(componentsDir, 'map-view.html'), `<template id="map-view">
      <div class="acme-map"><slot></slot></div>
    </template>
    <script type="module">
      export async function client ({ signal }) {
        await import('acme-styles/dist/acme.css', { signal })
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-view>Map</map-view></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content

    assert.ok(!html.includes('assets/css/acme-'), 'dependency CSS must not be linked during SSR')

    const cssEntry = Object.entries(app.outputFiles).find(([key, file]) => key.startsWith('assets/css/') && key.endsWith('.css') && file.text.includes('.acme-map'))
    assert.ok(cssEntry, 'dependency CSS output should exist')

    const [cssKey, cssFile] = cssEntry
    assert.match(cssKey, /assets\/css\/acme-[a-f0-9]{8}\.css$/)
    assert.ok(cssFile.text.includes('.base'), '@import should be resolved')
    assert.ok(/url\(\.\/marker-[A-Z0-9]+\.png\)/.test(cssFile.text), 'url() should be rewritten to a hashed asset')

    const imageEntry = Object.entries(app.outputFiles).find(([key]) => key.startsWith('assets/css/') && key.endsWith('.png'))
    assert.ok(imageEntry, 'referenced image should be emitted')

    const manifest = app.outputFiles['manifest.js'].text
    assert.ok(manifest.includes('"stylesheets"'), 'manifest should include stylesheets')
    assert.ok(manifest.includes('assets/css/acme-'), 'manifest should point at the hashed CSS file')

    const componentBundles = Object.entries(app.outputFiles)
      .filter(([key]) => key.endsWith('.js') && key !== 'manifest.js')
      .map(([, file]) => file.text)
      .join('\n')
    assert.ok(componentBundles.includes('importCSS'), 'compiled client bundle should rewrite CSS import() to window.__coralite__.dom.importCSS')
  })

  it('writes emitted binary URL assets without corrupting them', async () => {
    await writeFile(join(componentsDir, 'map-view.html'), `<template id="map-view"><div class="acme-map"></div></template>
    <script type="module">
      export async function client () {
        await import('acme-styles/dist/acme.css')
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-view></map-view></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await app.build()

    const imageEntry = Object.entries(app.outputFiles).find(([key]) => key.startsWith('assets/css/') && key.endsWith('.png'))
    assert.ok(imageEntry, 'referenced image should be emitted')

    const imagePath = join(outputDir, 'assets', 'css', imageEntry[1].hashedPath)
    await app.save()

    const written = await readFile(imagePath)
    assert.deepEqual(written, Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]))
  })

  it('supports page-level dynamic CSS imports with flat and Import Attributes options', async () => {
    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html><html><body><main>Page</main></body></html>
    <script type="module">
      import { definePage } from 'coralite'

      export default definePage({
        async client ({ signal }) {
          await import('acme-styles/dist/print.css', { media: 'print', nonce: 'abc123', signal })
          await import('acme-styles/dist/other.css', {
            with: { type: 'css', media: 'screen' },
            signal
          })
        }
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content

    assert.ok(!html.includes('assets/css/print-'), 'page dependency CSS must not be linked during SSR')
    assert.ok(html.includes('window.__coralite__.dom.importCSS('), 'page client() should rewrite CSS import to importCSS')

    const manifest = app.outputFiles['manifest.js'].text
    assert.ok(manifest.includes('"media":"print"'))
    assert.ok(manifest.includes('"nonce":"abc123"'))
    assert.ok(manifest.includes('"media":"screen"'))
  })

  it('supports dynamic CSS imports on pages authored with flat named exports', async () => {
    await writeFile(join(componentsDir, 'noop-el.html'), '<template id="noop-el"><div></div></template>')
    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <head></head>
    <body>
      <noop-el></noop-el>
    </body>
    </html>
    <script type="module">
      export async function client ({ signal }) {
        await import('acme-styles/dist/print.css', { media: 'print', signal })
      }
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content

    assert.ok(!html.includes('assets/css/print-'), 'flat page dependency CSS must not be linked during SSR')
    assert.ok(html.includes('window.__coralite__.dom.importCSS('), 'flat page client() should rewrite CSS import to importCSS')

    const manifest = app.outputFiles['manifest.js'].text
    assert.ok(manifest.includes('"media":"print"'))
  })

  it('shares one output when multiple components dynamically import the same stylesheet', async () => {
    const componentMarkup = (id) => `<template id="${id}"><div class="acme-map"></div></template>
    <script type="module">
      export async function client () {
        await import('acme-styles/dist/acme.css')
      }
    </script>`

    await writeFile(join(componentsDir, 'map-a.html'), componentMarkup('map-a'))
    await writeFile(join(componentsDir, 'map-b.html'), componentMarkup('map-b'))
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-a></map-a><map-b></map-b></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await app.build()

    const cssEntries = Object.keys(app.outputFiles).filter(key => key.startsWith('assets/css/') && key.endsWith('.css') && app.outputFiles[key].text.includes('.acme-map'))
    assert.equal(cssEntries.length, 1, 'duplicate imports of the same file should share one CSS output')
  })

  it('isolates relative ./local.css files imported from different component directories without handle collisions', async () => {
    const subA = join(componentsDir, 'a')
    const subB = join(componentsDir, 'b')
    await mkdir(subA, { recursive: true })
    await mkdir(subB, { recursive: true })

    await writeFile(join(subA, 'local.css'), '.local-a { color: purple; }\n')
    await writeFile(join(subB, 'local.css'), '.local-b { color: orange; }\n')

    await writeFile(join(subA, 'comp-a.html'), `<template id="comp-a"><div>A</div></template>
    <script type="module">
      export async function client () {
        await import('./local.css')
      }
    </script>`)

    await writeFile(join(subB, 'comp-b.html'), `<template id="comp-b"><div>B</div></template>
    <script type="module">
      export async function client () {
        await import('./local.css')
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><comp-a></comp-a><comp-b></comp-b></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await app.build()

    const cssTexts = Object.entries(app.outputFiles)
      .filter(([key]) => key.startsWith('assets/css/') && key.endsWith('.css'))
      .map(([, file]) => file.text)
    assert.ok(cssTexts.some(text => text.includes('.local-a')), 'comp-a local.css should be bundled')
    assert.ok(cssTexts.some(text => text.includes('.local-b')), 'comp-b local.css should be bundled')
  })

  it('allows remote https:// CSS URLs to pass through to runtime importCSS without bundling', async () => {
    await writeFile(join(componentsDir, 'remote-style.html'), `<template id="remote-style"><div>Remote</div></template>
    <script type="module">
      export async function client ({ signal }) {
        await import('https://cdn.example.com/theme.css', { media: 'screen', signal })
      }
    </script>`)
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><remote-style></remote-style></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await app.build()

    const componentBundles = Object.entries(app.outputFiles)
      .filter(([key]) => key.endsWith('.js') && key !== 'manifest.js')
      .map(([, file]) => file.text)
      .join('\n')
    assert.ok(componentBundles.includes('https://cdn.example.com/theme.css'))
    assert.ok(componentBundles.includes('importCSS'))
  })

  it('rejects top-level static CSS imports with CORALITE-E109', async () => {
    await writeFile(join(componentsDir, 'bad-static.html'), `<template id="bad-static"><div></div></template>
    <script type="module">
      import 'acme-styles/dist/acme.css'
    </script>`)
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><bad-static></bad-static></body></html>')

    await assert.rejects(
      () => createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        mode: 'production',
        incremental: false
      }),
      (err) => err.code === 'CORALITE-E109' && /Top-level CSS import/.test(err.message)
    )
  })

  it('rejects dynamic CSS imports inside server() with CORALITE-E109', async () => {
    await writeFile(join(componentsDir, 'bad-server.html'), `<template id="bad-server"><div></div></template>
    <script type="module">
      export async function server () {
        await import('acme-styles/dist/acme.css')
        return {}
      }
    </script>`)
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><bad-server></bad-server></body></html>')

    await assert.rejects(
      () => createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        mode: 'production',
        incremental: false
      }),
      (err) => err.code === 'CORALITE-E109' && /only supported inside "client\(\)"/.test(err.message)
    )
  })

  it('rejects invalid CSS import options with CORALITE-E109', async () => {
    await writeFile(join(componentsDir, 'bad-opts.html'), `<template id="bad-opts"><div></div></template>
    <script type="module">
      export async function client () {
        await import('acme-styles/dist/acme.css', { unknownOption: true })
      }
    </script>`)
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><bad-opts></bad-opts></body></html>')

    await assert.rejects(
      () => createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        mode: 'production',
        incremental: false
      }),
      (err) => err.code === 'CORALITE-E109' && /unknown option "unknownOption"/.test(err.message)
    )
  })

  it('rejects missing local CSS files at build time with CORALITE-E403', async () => {
    await writeFile(join(componentsDir, 'missing-css.html'), `<template id="missing-css"><div></div></template>
    <script type="module">
      export async function client () {
        await import('./does-not-exist.css')
      }
    </script>`)
    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><missing-css></missing-css></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await assert.rejects(
      () => app.build(),
      (err) => err.code === 'CORALITE-E403' && /resolved to a missing file/.test(err.message)
    )
  })

  it('runs configured PostCSS plugins over the bundled dependency CSS', async () => {
    const postcssPlugin = {
      postcssPlugin: 'coralite-test-add-rule',
      Once (root) {
        root.append({
          selector: '.postcss-added',
          nodes: [{
            prop: 'color',
            value: 'green'
          }]
        })
      }
    }

    await writeFile(join(componentsDir, 'map-view.html'), `<template id="map-view"><div class="acme-map"></div></template>
    <script type="module">
      export async function client () {
        await import('acme-styles/dist/acme.css')
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-view></map-view></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false,
      styles: {
        processors: {
          postcss: {
            plugins: [postcssPlugin]
          }
        }
      }
    })

    await app.build()

    const cssEntry = Object.entries(app.outputFiles).find(([key, file]) => key.startsWith('assets/css/') && key.endsWith('.css') && file.text.includes('.acme-map'))
    assert.ok(cssEntry, 'dependency CSS output should exist')
    assert.ok(cssEntry[1].text.includes('.postcss-added'), 'PostCSS output should be included in the emitted CSS')
  })

  it('emits dependency stylesheets in development mode', async () => {
    await writeFile(join(componentsDir, 'map-view.html'), `<template id="map-view"><div class="acme-map"></div></template>
    <script type="module">
      export async function client ({ signal }) {
        await import('acme-styles/dist/acme.css', { signal })
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-view></map-view></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'development',
      incremental: false
    })

    try {
      await app.build()

      const cssEntry = Object.entries(app.outputFiles).find(([key, file]) => key.startsWith('assets/css/') && key.endsWith('.css') && file.text.includes('.acme-map'))
      assert.ok(cssEntry, 'development build should emit dependency CSS')
      assert.ok(app.outputFiles['manifest.js'].text.includes('"stylesheets"'))
    } finally {
      await app.clearCache(true)
    }
  })

  it('bundles CSS dynamically imported from a transitive client helper module', async () => {
    const helperPath = join(componentsDir, 'load-map.js')
    await writeFile(helperPath, `export async function loadMapStyles (signal) {
      return import('acme-styles/dist/acme.css', { signal })
    }\n`)

    await writeFile(join(componentsDir, 'map-view.html'), `<template id="map-view"><div class="acme-map"></div></template>
    <script type="module">
      export async function client ({ signal }) {
        const { loadMapStyles } = await import('./load-map.js')
        await loadMapStyles(signal)
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><map-view></map-view></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    await app.build()

    const cssEntry = Object.entries(app.outputFiles).find(([key, file]) => key.startsWith('assets/css/') && key.endsWith('.css') && file.text.includes('.acme-map'))
    assert.ok(cssEntry, 'transitive helper dynamic CSS import should be bundled and emitted')
  })
})
