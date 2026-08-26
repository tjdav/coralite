import { test, expect } from '@playwright/test'
import { execSync, spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile, copyFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { existsSync } from 'node:fs'

const templates = ['css', 'scss']

for (const templateName of templates) {
  test.describe(`create-coralite template: ${templateName}`, () => {
    let tempDir
    let projectPath
    let serverProcess
    const port = templateName === 'css' ? 3003 : 3004

    test.beforeAll(async () => {
      const cliPath = join(process.cwd(), 'bin/index.js')

      if (!existsSync(cliPath)) {
        throw new Error(`CLI not found at ${cliPath}`)
      }

      tempDir = await mkdtemp(join(tmpdir(), `create-coralite-${templateName}-`))
      const projectName = `test-app-${templateName}`
      projectPath = join(tempDir, projectName)

      // Scaffold template
      execSync(`node "${cliPath}" -o "${projectName}" --template ${templateName}`, {
        cwd: tempDir,
        stdio: 'pipe'
      })

      if (!existsSync(projectPath)) {
        throw new Error(`Scaffolded directory ${projectPath} does not exist`)
      }

      // Resolve tarballs from the pre-built global setup location
      const tarballsDir = path.resolve(process.cwd(), 'tests/e2e/.tarballs')
      const filesInTarballs = await readdir(tarballsDir)
      const coraliteTarName = filesInTarballs.find(f => f.startsWith('coralite-') && !f.startsWith('coralite-scripts-'))
      const scriptsTarName = filesInTarballs.find(f => f.startsWith('coralite-scripts-'))

      if (!coraliteTarName || !scriptsTarName) {
        throw new Error(`Pre-built tarballs not found in ${tarballsDir}. Did globalSetup run?`)
      }

      const coraliteTarPath = join(tarballsDir, coraliteTarName)
      const scriptsTarPath = join(tarballsDir, scriptsTarName)

      // Copy tarballs to local tempDir so they can be referenced easily
      const localCoraliteTarPath = join(tempDir, coraliteTarName)
      const localScriptsTarPath = join(tempDir, scriptsTarName)
      await copyFile(coraliteTarPath, localCoraliteTarPath)
      await copyFile(scriptsTarPath, localScriptsTarPath)

      // Update package.json in scaffolded project to use packed tarballs
      const pkgJsonPath = join(projectPath, 'package.json')
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))

      const relativeCoralitePath = path.relative(projectPath, localCoraliteTarPath).split(path.sep).join('/')
      const relativeScriptsPath = path.relative(projectPath, localScriptsTarPath).split(path.sep).join('/')

      pkgJson.devDependencies = pkgJson.devDependencies || {}
      pkgJson.devDependencies['coralite'] = 'file:' + relativeCoralitePath
      pkgJson.devDependencies['coralite-scripts'] = 'file:' + relativeScriptsPath

      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))

      // Update coralite.config.js to use custom port
      const configPath = join(projectPath, 'coralite.config.js')
      let configContent = await readFile(configPath, 'utf8')
      configContent = configContent.replace(
        "components: 'src/components',",
        `components: 'src/components',\n  server: { port: ${port} },`
      )
      await writeFile(configPath, configContent)

      // Install dependencies using fast npm-offline fallback/cache
      execSync('npm install --prefer-offline --no-audit --no-fund', {
        cwd: projectPath,
        stdio: 'pipe'
      })

      // Spawn dev server directly via node to ensure clean termination
      let serverLogs = ''
      const scriptsBin = join(projectPath, 'node_modules/coralite-scripts/bin/index.js')
      serverProcess = spawn(process.execPath, [scriptsBin, 'dev'], {
        cwd: projectPath,
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules --experimental-import-meta-resolve'
        }
      })

      serverProcess.stdout?.on('data', chunk => { serverLogs += chunk.toString() })
      serverProcess.stderr?.on('data', chunk => { serverLogs += chunk.toString() })

      // Wait for server to respond
      const serverUrl = `http://localhost:${port}`
      let ready = false
      for (let i = 0; i < 40; i++) {
        try {
          const res = await fetch(serverUrl)
          if (res.ok) {
            ready = true
            break
          }
        } catch {
          // Retry
        }
        await new Promise(r => setTimeout(r, 500))
      }

      if (!ready) {
        throw new Error(`Dev server failed to start at ${serverUrl}. Server logs:\n${serverLogs}`)
      }
    })

    test.afterAll(async () => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL')
      }
      if (tempDir && existsSync(tempDir)) {
        await rm(tempDir, { recursive: true, force: true })
      }
      await new Promise(r => setTimeout(r, 1000))
    })

    test('should render all declarative components, preload confetti library on mount, and handle counter interaction', async ({ page }) => {
      const serverUrl = `http://localhost:${port}`

      // Listen for top-level dynamic HTTPS ESM import of canvas-confetti library during hydration
      const confettiResponsePromise = page.waitForResponse(
        res => res.url().includes('canvas-confetti') && res.status() === 200,
        { timeout: 15000 }
      )

      await page.goto(serverUrl)

      // Assert confetti library was pre-fetched successfully on client mount
      const confettiResponse = await confettiResponsePromise
      expect(confettiResponse.ok()).toBe(true)

      // Verify all declarative components exist and are rendered in the DOM
      const counterComponent = page.locator('coralite-counter')
      const cardComponent = page.locator('coralite-card')
      const footerComponent = page.locator('coralite-footer')

      await expect(counterComponent).toBeVisible()
      await expect(cardComponent).toBeVisible()
      await expect(footerComponent).toBeVisible()

      // Verify footer rendered capitalized name via attribute transform and dynamic year getter
      const currentYear = new Date().getFullYear().toString()
      await expect(footerComponent).toContainText(`Made with Coralite © ${currentYear}`)

      // Verify initial counter button state
      const countBtn = counterComponent.locator('button')
      await expect(countBtn).toBeVisible()
      await expect(countBtn).toHaveText(/Count is 0/)

      // Click count button
      await countBtn.click()

      // Assert count state incremented to 1
      await expect(countBtn).toHaveText(/Count is 1/)
    })
  })
}
