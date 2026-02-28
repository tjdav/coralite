import { execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const tempDir = await mkdtemp(join(tmpdir(), 'coralite-e2e-'))
const projectName = 'test-app'
const projectPath = join(tempDir, projectName)

console.log(`🚀 Starting E2E smoke test in ${tempDir}...`)

try {
  const cliPath = join(process.cwd(), 'packages/create-coralite/bin/index.js')
  if (!existsSync(cliPath)) {
    throw new Error(`CLI not found at ${cliPath}`)
  }

  console.log(`\n📦 Scaffolding project...`)
  // Pass -o to bypass prompts for project name and output dir, --template for template
  execSync(`node "${cliPath}" -o "${projectName}" --template css`, {
    cwd: tempDir,
    stdio: 'inherit'
  })

  if (!existsSync(projectPath)) {
    throw new Error(`Scaffolded project directory ${projectPath} does not exist`)
  }

  // Install dependencies
  console.log(`\n⬇️ Installing dependencies...`)
  // The scaffolded project might use npm or yarn, but npm install should work generally
  // Alternatively, we use `npm install`
  execSync('npm install', {
    cwd: projectPath,
    stdio: 'inherit'
  })

  // Run the build command
  console.log(`\n🛠️ Running build script...`)
  execSync('npm run build', {
    cwd: projectPath,
    stdio: 'inherit'
  })

  console.log(`\n✅ Smoke test passed successfully!`)

} catch (error) {
  console.error(`\n❌ Smoke test failed!`, error.message)
  process.exit(1)
} finally {
  console.log(`\n🧹 Cleaning up ${tempDir}...`)
  await rm(tempDir, {
    recursive: true,
    force: true
  })
}
