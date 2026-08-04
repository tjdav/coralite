import { execSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

export default async function globalSetup () {
  const repoRoot = path.resolve(process.cwd(), '../..')
  const sharedPackDir = path.join(process.cwd(), 'tests/e2e/.tarballs')

  // Clean and recreate shared tarballs directory
  if (existsSync(sharedPackDir)) {
    await rm(sharedPackDir, { recursive: true, force: true })
  }
  await mkdir(sharedPackDir, { recursive: true })

  // Build local workspace packages
  execSync('pnpm run build && pnpm run build:scripts', {
    cwd: repoRoot,
    stdio: 'pipe'
  })

  // Pack local workspace dependencies
  execSync('pnpm pack --pack-destination ' + sharedPackDir, {
    cwd: path.join(repoRoot, 'packages/coralite'),
    stdio: 'pipe'
  })

  execSync('pnpm pack --pack-destination ' + sharedPackDir, {
    cwd: path.join(repoRoot, 'packages/coralite-scripts'),
    stdio: 'pipe'
  })
}
