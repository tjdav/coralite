import { test, expect } from '@playwright/test'
import { execSync, spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'

const templates = ['css', 'scss']

for (const templateName of templates) {
  test.describe.serial(`create-coralite template: ${templateName}`, () => {
    let tempDir
    let projectPath
    let serverProcess
    const port = templateName === 'css' ? 3041 : 3042

    test.beforeAll(async () => {
      const cliPath = join(process.cwd(), 'bin/index.js')

      if (!existsSync(cliPath)) {
        throw new Error(`CLI not found at ${cliPath}`)
      }

      tempDir = await mkdtemp(join(tmpdir(), `create-coralite-${templateName}-`))
      const projectName = `test-app-${templateName}`
      projectPath = join(tempDir, projectName)

      execSync(`node "${cliPath}" -o "${projectName}" --template ${templateName} --no-ai`, {
        cwd: tempDir,
        stdio: 'pipe'
      })

      if (!existsSync(projectPath)) {
        throw new Error(`Scaffolded directory ${projectPath} does not exist`)
      }

      const repoRoot = path.resolve(process.cwd(), '../..')
      const coralitePkgPath = path.join(repoRoot, 'packages/coralite')

      const pkgJsonPath = join(projectPath, 'package.json')
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))

      const relativeCoralitePath = path.relative(projectPath, coralitePkgPath).split(path.sep).join('/')
      pkgJson.devDependencies = pkgJson.devDependencies || {}
      pkgJson.devDependencies.coralite = 'file:' + relativeCoralitePath

      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))

      const configPath = join(projectPath, 'coralite.config.js')
      let configContent = await readFile(configPath, 'utf8')
      configContent = configContent.replace(
        "components: 'src/components',",
        `components: 'src/components',\n  server: { port: ${port} },`
      )
      await writeFile(configPath, configContent)

      execSync('npm install --prefer-offline --no-audit --no-fund', {
        cwd: projectPath,
        stdio: 'pipe'
      })
    })

    test.afterAll(async () => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL')
      }
      if (tempDir && existsSync(tempDir)) {
        await rm(tempDir, {
          recursive: true,
          force: true
        })
      }
      await new Promise(r => setTimeout(r, 1000))
    })

    test('should pass validation check with zero errors and zero warnings', async () => {
      const checkOutput = execSync('npm run check', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      })

      expect(checkOutput).toContain('0 error(s)')
      expect(checkOutput).toContain('0 warning(s)')
    })

    test('should build production static output in dist directory', async () => {
      execSync('npm run build', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      })

      const distDir = join(projectPath, 'dist')
      expect(existsSync(distDir)).toBe(true)

      const distFiles = readdirSync(distDir)
      expect(distFiles).toContain('index.html')
      expect(distFiles).toContain('assets')
      expect(distFiles).toContain('favicon.ico')

      const indexHtml = await readFile(join(distDir, 'index.html'), 'utf8')
      expect(indexHtml).toContain('<site-counter')
      expect(indexHtml).toContain('<site-card')
      expect(indexHtml).toContain('<site-footer')
    })

    test('should serve interactive application with working hydration and reactivity in dev mode', async ({ page }) => {
      let serverLogs = ''
      const coraliteBin = join(projectPath, 'node_modules/coralite/bin/coralite.js')
      serverProcess = spawn(process.execPath, [coraliteBin, 'dev'], {
        cwd: projectPath,
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules --experimental-import-meta-resolve'
        }
      })

      serverProcess.stdout?.on('data', chunk => {
        serverLogs += chunk.toString()
      })
      serverProcess.stderr?.on('data', chunk => {
        serverLogs += chunk.toString()
      })

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
        }
        await new Promise(r => setTimeout(r, 500))
      }

      if (!ready) {
        throw new Error(`Dev server failed to start at ${serverUrl}. Server logs:\n${serverLogs}`)
      }

      const confettiResponsePromise = page.waitForResponse(
        res => res.url().includes('canvas-confetti') && res.status() === 200,
        { timeout: 15000 }
      )

      await page.goto(serverUrl)

      const confettiResponse = await confettiResponsePromise
      expect(confettiResponse.ok()).toBe(true)

      const counterComponent = page.locator('site-counter')
      const cardComponent = page.locator('site-card')
      const footerComponent = page.locator('site-footer')

      await expect(counterComponent).toBeVisible()
      await expect(cardComponent).toBeVisible()
      await expect(footerComponent).toBeVisible()

      const currentYear = new Date().getFullYear().toString()
      await expect(footerComponent).toContainText(`Made with Coralite © ${currentYear}`)

      const countBtn = counterComponent.locator('button')
      await expect(countBtn).toBeVisible()
      await expect(countBtn).toHaveText(/Count is 0/)

      await page.waitForFunction(() => Boolean(customElements.get('site-counter')))
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)))

      await countBtn.click()

      await expect(countBtn).toHaveText(/Count is 1/)
    })
  })
}
