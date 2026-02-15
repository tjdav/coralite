import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT_DIR = process.cwd() // Assuming running from repo root
const PACKAGES_DIR = resolve(ROOT_DIR, 'packages')

// Helper to get package name from argument
const args = process.argv.slice(2)
const targetPackageName = args[0]

if (!targetPackageName) {
  console.error('Usage: node scripts/smoke.js <package-name>')
  process.exit(1)
}

const PACKAGE_ROOT = resolve(PACKAGES_DIR, targetPackageName)
const TEMP_DIR = join(tmpdir(), `${targetPackageName}-smoke-${Date.now()}`)

if (!existsSync(PACKAGE_ROOT)) {
  console.error(`Package directory not found: ${PACKAGE_ROOT}`)
  process.exit(1)
}

console.log(`Running smoke test for ${targetPackageName}...`)
console.log(`Package Root: ${PACKAGE_ROOT}`)
console.log(`Repo Root: ${ROOT_DIR}`)

function cleanup () {
  try {
    if (TEMP_DIR && existsSync(TEMP_DIR)) {
      console.log('Cleaning up temp dir...')
      rmSync(TEMP_DIR, {
        recursive: true,
        force: true
      })
    }
    // Remove generated tarballs in package root
    const tarballs = readdirSync(PACKAGE_ROOT).filter(f => f.endsWith('.tgz'))
    for (const file of tarballs) {
      rmSync(join(PACKAGE_ROOT, file))
    }

    // For coralite-scripts, we might have a coralite tarball in coralite package
    if (targetPackageName === 'coralite-scripts') {
      const coraliteRoot = resolve(PACKAGES_DIR, 'coralite')
      if (existsSync(coraliteRoot)) {
        const cTarballs = readdirSync(coraliteRoot).filter(f => f.endsWith('.tgz'))
        for (const file of cTarballs) {
          rmSync(join(coraliteRoot, file))
        }
      }
    }

  } catch (e) {
    console.error('Error during cleanup:', e)
  }
}

try {
  // Build the package
  console.log(`Building ${targetPackageName}...`)
  try {
    const pkgJsonPath = join(PACKAGE_ROOT, 'package.json')
    if (existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      if (pkgJson.scripts && pkgJson.scripts.build) {
        console.log(`Found build script, executing...`)
        execSync('pnpm run build', {
          cwd: PACKAGE_ROOT,
          stdio: 'inherit'
        })
      } else {
        console.log(`No build script found for ${targetPackageName}, skipping build.`)
      }
    }
  } catch (e) {
    console.warn(`Could not run build for ${targetPackageName}: ${e.message}`)
  }

  // Pack the current package
  console.log(`Packing ${targetPackageName}...`)
  // Use pnpm pack to handle workspace:* resolution
  const packOutput = execSync('pnpm pack', { cwd: PACKAGE_ROOT }).toString().trim()
  const tarballName = packOutput.split('\n').pop()
  const tarballPath = resolve(PACKAGE_ROOT, tarballName)

  if (!tarballName || !tarballName.endsWith('.tgz')) {
    throw new Error(`Failed to pack package. Output: ${packOutput}`)
  }
  console.log(`Packed: ${tarballPath}`)

  // Special handling for dependencies
  let extraTarballs = []
  if (targetPackageName === 'coralite-scripts') {
    console.log('Building and Packing dependency: coralite...')
    const coraliteRoot = resolve(PACKAGES_DIR, 'coralite')
    if (!existsSync(coraliteRoot)) {
      throw new Error(`Coralite root not found at ${coraliteRoot}`)
    }
    execSync('pnpm run build', {
      cwd: coraliteRoot,
      stdio: 'inherit'
    })
    const cPackOutput = execSync('pnpm pack', { cwd: coraliteRoot }).toString().trim()
    const cTarballName = cPackOutput.split('\n').pop()
    const cTarballPath = resolve(coraliteRoot, cTarballName)
    extraTarballs.push(cTarballPath)
  }

  // Create temp environment
  console.log(`Creating temp env at ${TEMP_DIR}...`)
  mkdirSync(TEMP_DIR, { recursive: true })
  execSync('npm init -y', {
    cwd: TEMP_DIR,
    stdio: 'ignore'
  })

  // Install
  console.log('Installing package(s)...')
  const allTarballs = [tarballPath, ...extraTarballs].map(p => `"${p}"`).join(' ')
  // Use npm install to verify package integrity
  execSync(`npm install ${allTarballs}`, {
    cwd: TEMP_DIR,
    stdio: 'inherit'
  })

  // Specific Verification Logic
  if (targetPackageName === 'coralite') {
    // Verify CLI
    console.log('Verifying CLI...')
    const cliPath = join(TEMP_DIR, 'node_modules', '.bin', 'coralite')
    const helpOutput = execSync(`"${cliPath}" --help`, { cwd: TEMP_DIR }).toString()
    if (!helpOutput.includes('Usage: Coralite') && !helpOutput.includes('Usage: coralite')) {
      throw new Error(`CLI help output verification failed. Output: ${helpOutput}`)
    }
    console.log('CLI verification passed.')

    // Verify Import
    console.log('Verifying Library Import...')
    const testScriptPath = join(TEMP_DIR, 'test-import.mjs')
    const testScriptContent = `
        import { Coralite } from 'coralite';
        console.log('Import successful:', typeof Coralite);
      `
    writeFileSync(testScriptPath, testScriptContent)
    const importOutput = execSync(`node "${testScriptPath}"`, { cwd: TEMP_DIR }).toString()
    if (!importOutput.includes('Import successful')) {
      throw new Error('Library import verification failed')
    }
    console.log('Library import verification passed.')
  } else if (targetPackageName === 'create-coralite') {
    console.log('Verifying CLI...')
    const cliPath = join(TEMP_DIR, 'node_modules', '.bin', 'create-coralite')
    const helpOutput = execSync(`"${cliPath}" --help`, { cwd: TEMP_DIR }).toString()
    if (!helpOutput.includes('Usage: create-coralite')) {
      throw new Error(`CLI help output verification failed. Output: ${helpOutput}`)
    }
    console.log('CLI verification passed.')
  } else if (targetPackageName === 'coralite-release') {
    console.log('Verifying CLI (coralite-release)...')
    const cliReleasePath = join(TEMP_DIR, 'node_modules', '.bin', 'coralite-release')
    const helpOutput = execSync(`"${cliReleasePath}" --help`, { cwd: TEMP_DIR }).toString()
    if (!helpOutput.includes('Usage: release')) {
      throw new Error(`CLI help output verification failed. Output: ${helpOutput}`)
    }
    console.log('CLI verification passed.')

    console.log('Verifying CLI (coralite-changelog)...')
    const cliChangelogPath = join(TEMP_DIR, 'node_modules', '.bin', 'coralite-changelog')
    if (!existsSync(cliChangelogPath)) {
      throw new Error('coralite-changelog binary missing.')
    }
    console.log('coralite-changelog binary exists.')
  } else if (targetPackageName === 'coralite-scripts') {
    console.log('Verifying CLI...')
    const cliPath = join(TEMP_DIR, 'node_modules', '.bin', 'coralite-scripts')
    const helpOutput = execSync(`"${cliPath}" --help`, { cwd: TEMP_DIR }).toString()
    if (!helpOutput.includes('Usage: Coralite scripts')) {
      throw new Error(`CLI help output verification failed. Output: ${helpOutput}`)
    }
    console.log('CLI verification passed.')
  } else {
    throw new Error(`Unknown package: ${targetPackageName}`)
  }

  console.log(`Smoke test passed for ${targetPackageName}!`)

} catch (error) {
  console.error(`Smoke test failed for ${targetPackageName}:`, error)
  process.exit(1)
} finally {
  cleanup()
}
