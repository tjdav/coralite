import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const coralitePackageDir = resolve(__dirname, '../../../')

describe('packaged tarball consumer smoke test', () => {
  let tempBaseDir
  let packDir
  let consumerDir

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'coralite-pack-test-'))
    packDir = join(tempBaseDir, 'pack')
    consumerDir = join(tempBaseDir, 'consumer')
    await mkdir(packDir, { recursive: true })
    await mkdir(consumerDir, { recursive: true })
  })

  afterEach(async () => {
    if (tempBaseDir) {
      await rm(tempBaseDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('installs extracted tarball into isolated consumer app and verifies build and check without public dir', async () => {
    execFileSync('npm', ['pack', '--ignore-scripts', `--pack-destination=${packDir}`], {
      cwd: coralitePackageDir,
      stdio: 'pipe'
    })

    const packEntries = await readdir(packDir)
    const tarballName = packEntries.find((f) => f.endsWith('.tgz'))
    assert.ok(tarballName, 'npm pack should have produced a .tgz tarball')
    const tarballPath = join(packDir, tarballName)

    const extractDir = join(packDir, 'extracted')
    await mkdir(extractDir, { recursive: true })
    execFileSync('tar', ['-xzf', tarballPath, '-C', extractDir], {
      stdio: 'pipe'
    })

    const extractedPackageDir = join(extractDir, 'package')
    assert.ok(existsSync(extractedPackageDir), 'Tarball should unpack to package/ directory')

    const consumerNodeModules = join(consumerDir, 'node_modules')
    const installedCoralite = join(consumerNodeModules, 'coralite')
    await mkdir(consumerNodeModules, { recursive: true })

    await cp(extractedPackageDir, installedCoralite, { recursive: true })

    const localNodeModules = join(coralitePackageDir, 'node_modules')
    if (existsSync(localNodeModules)) {
      const topDeps = await readdir(localNodeModules)
      for (const dep of topDeps) {
        if (dep === 'coralite' || dep.startsWith('.')) {
          continue
        }
        const srcDep = join(localNodeModules, dep)
        const targetDep = join(consumerNodeModules, dep)
        if (!existsSync(targetDep)) {
          try {
            await cp(srcDep, targetDep, { recursive: true })
          } catch {
            // Ignore optional symlink/copy failures for non-essential deps
          }
        }
      }
    }

    const packageJsonContent = JSON.stringify({
      name: 'consumer-sample-app',
      version: '1.0.0',
      type: 'module'
    }, null, 2)
    await writeFile(join(consumerDir, 'package.json'), packageJsonContent, 'utf8')

    const configContent = `import { defineConfig } from 'coralite'

export default defineConfig({
  output: 'dist',
  components: 'src/components',
  pages: 'src/pages',
  cleanUrls: true
})
`
    await writeFile(join(consumerDir, 'coralite.config.js'), configContent, 'utf8')

    await mkdir(join(consumerDir, 'src', 'components'), { recursive: true })
    await mkdir(join(consumerDir, 'src', 'pages'), { recursive: true })

    const shellContent = `<template id="app-shell">
  <header><h1>Consumer App</h1></header>
  <main data-router-outlet><slot></slot></main>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    await writeFile(join(consumerDir, 'src', 'components', 'app-shell.html'), shellContent, 'utf8')

    const indexContent = `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <app-shell>
    <h2>Home Page</h2>
    <a href="/second">Go to second</a>
  </app-shell>
</body>
</html>
`
    await writeFile(join(consumerDir, 'src', 'pages', 'index.html'), indexContent, 'utf8')

    const secondContent = `<!DOCTYPE html>
<html>
<head><title>Second</title></head>
<body>
  <router-outlet>
    <h2>Second Page</h2>
    <a href="/">Back home</a>
  </router-outlet>
</body>
</html>
`
    await writeFile(join(consumerDir, 'src', 'pages', 'second.html'), secondContent, 'utf8')

    const cliEntry = join(installedCoralite, 'bin', 'coralite.js')

    const checkOutput = execFileSync(process.execPath, [cliEntry, 'check'], {
      cwd: consumerDir,
      encoding: 'utf8',
      stdio: 'pipe'
    })

    assert.strictEqual(
      checkOutput.includes('Unknown custom element tag "<router-outlet>"'),
      false,
      'router-outlet should not be flagged as unknown custom element'
    )

    const buildOutput = execFileSync(process.execPath, [cliEntry, 'build'], {
      cwd: consumerDir,
      encoding: 'utf8',
      stdio: 'pipe'
    })

    assert.strictEqual(
      buildOutput.includes('Build failed'),
      false,
      'Build should succeed without ENOENT when public directory does not exist'
    )

    const distIndex = await readFile(join(consumerDir, 'dist', 'index.html'), 'utf8')
    assert.ok(distIndex.includes('data-router-outlet'), 'dist/index.html should render data-router-outlet')
    assert.ok(distIndex.includes('Home Page'), 'dist/index.html should render Home Page content')

    const distSecond = await readFile(join(consumerDir, 'dist', 'second', 'index.html'), 'utf8')
    assert.ok(distSecond.includes('router-outlet'), 'dist/second/index.html should render router-outlet')
    assert.ok(distSecond.includes('Second Page'), 'dist/second/index.html should render Second Page content')
  })
})
