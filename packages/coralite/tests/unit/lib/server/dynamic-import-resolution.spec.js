import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createCoralite, rewriteDynamicImports } from '#lib'

describe('rewriteDynamicImports', () => {
  it('rewrites dynamic imports while preserving static imports, metadata, strings, comments, and line numbers', () => {
    const source = `import { value } from './static.js'
// import('./comment.js')
const literal = "import('./string.js')"
const metadata = import.meta.url
const withOptions = import('./data.json', { with: { type: 'json' } })
const dynamic = await import(specifier)`

    const output = rewriteDynamicImports(source)

    assert.ok(output.includes("import { value } from './static.js'"))
    assert.ok(output.includes("// import('./comment.js')"))
    assert.ok(output.includes('"import(\'./string.js\')"'))
    assert.ok(output.includes('const metadata = import.meta.url'))
    assert.ok(output.includes("__coralite_import__('./data.json', { with: { type: 'json' } })"))
    assert.ok(output.includes('__coralite_import__(specifier)'))
    assert.strictEqual(output.split('\n').length, source.split('\n').length)
  })
})

describe('Dynamic import resolution in component and page scripts', () => {
  let projectDir
  let pagesDir
  let componentsDir
  let app

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-dynamic-import-'))
    pagesDir = join(projectDir, 'pages')
    componentsDir = join(projectDir, 'components')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ type: 'module' }))
    app = null
  })

  afterEach(async () => {
    if (app) {
      try {
        await app.clearCache(true)
      } catch {
        // The build may have failed before the cache was initialized.
      }
    }
    if (projectDir) {
      await rm(projectDir, {
        recursive: true,
        force: true
      })
    }
  })

  async function writeProjectFile (relativePath, content) {
    const target = join(projectDir, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  async function buildProject (mode = 'production') {
    app = await createCoralite({
      projectRoot: projectDir,
      pages: pagesDir,
      components: componentsDir,
      output: join(projectDir, 'dist'),
      mode,
      incremental: false
    })
    return app.build()
  }

  async function buildComponent ({ script, mode = 'production', files = {} }) {
    for (const [relativePath, content] of Object.entries(files)) {
      await writeProjectFile(relativePath, content)
    }

    await writeProjectFile('components/dyn-comp.html', `<template id="dyn-comp"><div id="out">{{ value }}</div></template>
<script type="module">
${script}
</script>`)
    await writeProjectFile('pages/index.html', '<!DOCTYPE html><html><body><dyn-comp></dyn-comp></body></html>')

    const results = await buildProject(mode)
    return results[0]
  }

  const jsonFixtures = {
    'components/data.json': JSON.stringify({
      message: 'json-with-attributes',
      'foo-bar': 'invalid-identifier',
      class: 'reserved-word'
    }),
    'components/data-plain.json': JSON.stringify({
      message: 'json-without-attributes',
      'foo-bar': 'invalid-identifier',
      class: 'reserved-word'
    }),
    'components/helper.js': 'export const message = "relative-esm"\n',
    'components/extensionless.js': 'export const message = "extensionless"\n',
    'components/utils/index.js': 'export const message = "directory-index"\n'
  }

  const barePackageFixtures = {
    'node_modules/dummy-pkg/package.json': JSON.stringify({
      name: 'dummy-pkg',
      version: '1.0.0',
      type: 'module',
      main: 'index.js'
    }),
    'node_modules/dummy-pkg/index.js': 'export const message = "bare-package"\n'
  }

  it('resolves relative JSON imports with and without import attributes in production', async () => {
    const result = await buildComponent({
      mode: 'production',
      files: jsonFixtures,
      script: `export async function server () {
  const withAttributes = await import('./data.json', { with: { type: 'json' } })
  const withoutAttributes = await import('./data-plain.json')
  return {
    value: [
      withAttributes.default.message,
      withAttributes.default['foo-bar'],
      withAttributes.default.class,
      withoutAttributes.default.message,
      withoutAttributes.message
    ].join('|')
  }
}`
    })

    assert.ok(result.content.includes('json-with-attributes|invalid-identifier|reserved-word|json-without-attributes|json-without-attributes'))
  })

  it('resolves relative ESM, extensionless, and directory-index imports in production', async () => {
    const result = await buildComponent({
      mode: 'production',
      files: jsonFixtures,
      script: `export async function server () {
  const esm = await import('./helper.js')
  const extensionless = await import('./extensionless')
  const directory = await import('./utils')
  return { value: [esm.message, extensionless.message, directory.message].join('|') }
}`
    })

    assert.ok(result.content.includes('relative-esm|extensionless|directory-index'))
  })

  it('resolves project node_modules packages in production', async () => {
    const result = await buildComponent({
      mode: 'production',
      files: barePackageFixtures,
      script: `export async function server () {
  const pkg = await import('dummy-pkg')
  return { value: pkg.message }
}`
    })

    assert.ok(result.content.includes('bare-package'))
  })

  it('supports builtins, coralite virtual modules, import.meta.url, and import.meta.resolve in production', async () => {
    const result = await buildComponent({
      mode: 'production',
      files: jsonFixtures,
      script: `export async function server () {
  const fs = await import('node:fs')
  const coralite = await import('coralite')
  return {
    value: [
      typeof fs.readFile,
      typeof coralite.defineComponent,
      import.meta.url,
      import.meta.resolve('./data.json')
    ].join('|')
  }
}`
    })

    assert.ok(result.content.includes(`function|function|${pathToFileURL(join(componentsDir, 'dyn-comp.html')).href}|${pathToFileURL(join(componentsDir, 'data.json')).href}`))
  })

  it('resolves relative JSON imports from a page server handler in production', async () => {
    await writeProjectFile('pages/page-data.json', JSON.stringify({ message: 'page-json' }))
    await writeProjectFile('pages/index.html', `<script type="module">
export async function server () {
  const data = await import('./page-data.json')
  return { value: data.default.message }
}
</script>
<h1>{{ value }}</h1>`)

    const results = await buildProject('production')
    assert.ok(results[0].content.includes('page-json'))
  })

  it('attributes unresolvable specifiers to the owning component in production', async () => {
    await writeProjectFile('components/dyn-comp.html', `<template id="dyn-comp"><div>{{ value }}</div></template>
<script type="module">
export async function server () {
  const missing = await import('./does-not-exist.js')
  return { value: missing }
}
</script>`)
    await writeProjectFile('pages/index.html', '<!DOCTYPE html><html><body><dyn-comp></dyn-comp></body></html>')

    await assert.rejects(
      () => buildProject('production'),
      (error) => {
        assert.ok(error.message.includes('./does-not-exist.js'))
        assert.ok(error.message.includes(join(componentsDir, 'dyn-comp.html')))
        return true
      }
    )
  })

  it('matches production resolution behavior in development mode', async () => {
    const result = await buildComponent({
      mode: 'development',
      files: {
        ...jsonFixtures,
        ...barePackageFixtures
      },
      script: `export async function server () {
  const withAttributes = await import('./data.json', { with: { type: 'json' } })
  const withoutAttributes = await import('./data-plain.json')
  const esm = await import('./helper.js')
  const extensionless = await import('./extensionless')
  const directory = await import('./utils')
  const pkg = await import('dummy-pkg')
  const fs = await import('node:fs')
  const coralite = await import('coralite')
  return {
    value: [
      withAttributes.default.message,
      withAttributes.default['foo-bar'],
      withAttributes.default.class,
      withoutAttributes.default.message,
      esm.message,
      extensionless.message,
      directory.message,
      pkg.message,
      typeof fs.readFile,
      typeof coralite.defineComponent,
      import.meta.url,
      import.meta.resolve('./data.json')
    ].join('|')
  }
}`
    })

    assert.ok(result.content.includes(`json-with-attributes|invalid-identifier|reserved-word|json-without-attributes|relative-esm|extensionless|directory-index|bare-package|function|function|${pathToFileURL(join(componentsDir, 'dyn-comp.html')).href}|${pathToFileURL(join(componentsDir, 'data.json')).href}`))
  })

  it('resolves relative JSON imports from a page server handler in development', async () => {
    await writeProjectFile('pages/page-data.json', JSON.stringify({ message: 'page-json-dev' }))
    await writeProjectFile('pages/index.html', `<script type="module">
export async function server () {
  const data = await import('./page-data.json')
  return { value: data.default.message }
}
</script>
<h1>{{ value }}</h1>`)

    const results = await buildProject('development')
    assert.ok(results[0].content.includes('page-json-dev'))
  })

  it('attributes unresolvable specifiers to the owning component in development', async () => {
    await writeProjectFile('components/dyn-comp.html', `<template id="dyn-comp"><div>{{ value }}</div></template>
<script type="module">
export async function server () {
  const missing = await import('./does-not-exist.js')
  return { value: missing }
}
</script>`)
    await writeProjectFile('pages/index.html', '<!DOCTYPE html><html><body><dyn-comp></dyn-comp></body></html>')

    await assert.rejects(
      () => buildProject('development'),
      (error) => {
        assert.ok(error.message.includes('./does-not-exist.js'))
        assert.ok(error.message.includes(join(componentsDir, 'dyn-comp.html')))
        return true
      }
    )
  })
})
