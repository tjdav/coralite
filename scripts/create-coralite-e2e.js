import { execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import fs from 'node:fs'

const TEMP_DIR = await mkdtemp(join(tmpdir(), 'coralite-e2e-'))
const PROJECT_NAME = 'test-app'
const PROJECT_PATH = join(TEMP_DIR, PROJECT_NAME)

console.log(`🚀 Starting E2E smoke test in ${TEMP_DIR}...`)

try {
  const CLI_PATH = join(process.cwd(), 'packages/create-coralite/bin/index.js')
  if (!existsSync(CLI_PATH)) {
    throw new Error(`CLI not found at ${CLI_PATH}`)
  }

  console.log(`\n📦 Scaffolding project...`)
  // Pass -o to bypass prompts for project name and output dir, --template for template
  execSync(`node "${CLI_PATH}" -o "${PROJECT_NAME}" --template css`, {
    cwd: TEMP_DIR,
    stdio: 'inherit'
  })

  if (!existsSync(PROJECT_PATH)) {
    throw new Error(`Scaffolded project directory ${PROJECT_PATH} does not exist`)
  }


  console.log('\n📦 Packing local workspace packages...')
  execSync('pnpm run build', {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  const coralitePackOutput = execSync('pnpm pack --pack-destination ' + TEMP_DIR, {
    cwd: join(process.cwd(), 'packages/coralite')
  }).toString().trim()
  const coraliteTarName = coralitePackOutput.split('\n').pop()
  const coraliteTarPath = coraliteTarName.startsWith('/') ? coraliteTarName : join(TEMP_DIR, coraliteTarName)

  const scriptsPackOutput = execSync('pnpm pack --pack-destination ' + TEMP_DIR, {
    cwd: join(process.cwd(), 'packages/coralite-scripts')
  }).toString().trim()
  const scriptsTarName = scriptsPackOutput.split('\n').pop()
  const scriptsTarPath = scriptsTarName.startsWith('/') ? scriptsTarName : join(TEMP_DIR, scriptsTarName)

  const pkgJsonPath = join(PROJECT_PATH, 'package.json')
  const pkgJson = JSON.parse(await fs.promises.readFile(pkgJsonPath, 'utf8'))

  pkgJson.devDependencies['coralite'] = 'file:' + coraliteTarPath
  pkgJson.devDependencies['coralite-scripts'] = 'file:' + scriptsTarPath

  await fs.promises.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))


  // Install dependencies
  console.log(`\n⬇️ Installing dependencies...`)
  // The scaffolded project might use npm or yarn, but npm install should work generally
  // Alternatively, we use `npm install`
  execSync('npm install', {
    cwd: PROJECT_PATH,
    stdio: 'inherit'
  })

  // Run the build command
  console.log(`\n🛠️ Running build script...`)
  execSync('npm run build', {
    cwd: PROJECT_PATH,
    stdio: 'inherit'
  })

  console.log(`\n✅ Smoke test passed successfully!`)

} catch (error) {
  console.error(`\n❌ Smoke test failed!`, error.message)
  process.exit(1)
} finally {
  console.log(`\n🧹 Cleaning up ${TEMP_DIR}...`)
  await rm(TEMP_DIR, {
    recursive: true,
    force: true
  })
}
