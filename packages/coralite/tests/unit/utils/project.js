import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * Creates a temporary project directory with pages and components folders.
 * @returns {Promise<{
 *   testDir: string,
 *   pagesDir: string,
 *   componentsDir: string,
 *   outputDir: string,
 *   cleanup: () => Promise<void>,
 *   writePage: (name: string, content: string) => Promise<string>,
 *   writeComponent: (name: string, content: string) => Promise<string>
 * }>}
 */
export async function createTestProject () {
  const testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
  const pagesDir = path.join(testDir, 'pages')
  const componentsDir = path.join(testDir, 'components')
  const outputDir = path.join(testDir, 'dist')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  return {
    testDir,
    pagesDir,
    componentsDir,
    outputDir,
    cleanup: () => rm(testDir, {
      recursive: true,
      force: true
    }),
    writePage: (name, content) => {
      const filePath = path.join(pagesDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    writeComponent: (name, content) => {
      const filePath = path.join(componentsDir, name)
      return writeFile(filePath, content).then(() => filePath)
    }
  }
}
