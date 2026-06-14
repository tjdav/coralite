import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createCoralite } from '#lib'

/**
 * Creates a temporary project directory with pages and components folders.
 * @param {any} [defaultOptions] - Coralite options
 * @returns {Promise<{
 *   testDir: string,
 *   pagesDir: string,
 *   componentsDir: string,
 *   outputDir: string,
 *   coralite: any,
 *   cleanup: () => Promise<void>,
 *   writePage: (name: string, content: string) => Promise<string>,
 *   writeComponent: (name: string, content: string) => Promise<string>,
 *   createCoralite: (options?: any) => Promise<any>
 * }>}
 */
export async function createTestProject (defaultOptions = {}) {
  const testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
  const pagesDir = path.join(testDir, 'pages')
  const componentsDir = path.join(testDir, 'components')
  const outputDir = path.join(testDir, 'dist')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const project = {
    testDir,
    pagesDir,
    componentsDir,
    outputDir,
    coralite: null,
    cleanup: async function () {
      if (this.coralite) {
        await this.coralite.clearCache(true)
      }
      return rm(testDir, {
        recursive: true,
        force: true
      })
    },
    writePage: (name, content) => {
      const filePath = path.join(pagesDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    writeComponent: (name, content) => {
      const filePath = path.join(componentsDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    createCoralite: async function (options = {}) {
      this.coralite = await createCoralite({
        pages: pagesDir,
        components: componentsDir,
        output: outputDir,
        projectRoot: testDir,
        ...defaultOptions,
        ...options
      })
      return this.coralite
    }
  }

  return project
}
