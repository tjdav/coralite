import { test, expect } from '@playwright/test'
import { execSync, spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { existsSync } from 'node:fs'

const templates = ['css', 'scss']

for (const templateName of templates) {
  test.describe(`create-coralite template: ${templateName}`, () => {
    let tempDir
    let projectPath
    let serverProcess
    const port = 3000

    test.beforeAll(async () => {
      const repoRoot = path.resolve(process.cwd(), '../..')
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

      // Build local workspace packages
      execSync('pnpm run build && pnpm run build:scripts', {
        cwd: repoRoot,
        stdio: 'pipe'
      })

      // Pack local workspace dependencies
      const coralitePackOutput = execSync('pnpm pack --pack-destination ' + tempDir, {
        cwd: join(repoRoot, 'packages/coralite')
      }).toString().trim()
      const coraliteTarName = coralitePackOutput.split('\n').pop()
      const coraliteTarPath = path.isAbsolute(coraliteTarName) ? coraliteTarName : join(tempDir, coraliteTarName)

      const scriptsPackOutput = execSync('pnpm pack --pack-destination ' + tempDir, {
        cwd: join(repoRoot, 'packages/coralite-scripts')
      }).toString().trim()
      const scriptsTarName = scriptsPackOutput.split('\n').pop()
      const scriptsTarPath = path.isAbsolute(scriptsTarName) ? scriptsTarName : join(tempDir, scriptsTarName)

      // Update package.json in scaffolded project to use packed tarballs
      const pkgJsonPath = join(projectPath, 'package.json')
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))

      const relativeCoralitePath = path.relative(projectPath, coraliteTarPath).split(path.sep).join('/')
      const relativeScriptsPath = path.relative(projectPath, scriptsTarPath).split(path.sep).join('/')

      pkgJson.devDependencies = pkgJson.devDependencies || {}
      pkgJson.devDependencies['coralite'] = 'file:' + relativeCoralitePath
      pkgJson.devDependencies['coralite-scripts'] = 'file:' + relativeScriptsPath

      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))

      // Install dependencies
      execSync('npm install', {
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
      const serverUrl = 'http://localhost:3000'
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

    test('should render all declarative components and load confetti library on counter click', async ({ page }) => {
      const serverUrl = 'http://localhost:3000'
      await page.goto(serverUrl)

      // Verify all declarative components exist and are rendered in the DOM
      const counterComponent = page.locator('coralite-counter')
      const cardComponent = page.locator('coralite-card')
      const footerComponent = page.locator('coralite-footer')

      await expect(counterComponent).toBeVisible()
      await expect(cardComponent).toBeVisible()
      await expect(footerComponent).toBeVisible()

      // Verify initial counter button state
      const countBtn = counterComponent.locator('button')
      await expect(countBtn).toBeVisible()
      await expect(countBtn).toHaveText(/Count is 0/)

      // Listen for dynamic HTTPS ESM import of canvas-confetti library
      const confettiResponsePromise = page.waitForResponse(
        res => res.url().includes('canvas-confetti') && res.status() === 200,
        { timeout: 15000 }
      )

      // Click count button
      await countBtn.click()

      // Assert confetti library fetched successfully
      const confettiResponse = await confettiResponsePromise
      expect(confettiResponse.ok()).toBe(true)

      // Assert count state incremented to 1
      await expect(countBtn).toHaveText(/Count is 1/)
    })
  })
}
