import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

export default async function globalTeardown () {
  const sharedPackDir = path.join(process.cwd(), 'tests/e2e/.tarballs')
  if (existsSync(sharedPackDir)) {
    await rm(sharedPackDir, { recursive: true, force: true })
  }
}
