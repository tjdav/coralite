import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const binPath = path.resolve(__dirname, '../../bin/index.js')
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')

/**
 * Creates a temporary project directory with pages, components and public folders.
 * @returns {Promise<{
 *   testDir: string,
 *   pagesDir: string,
 *   componentsDir: string,
 *   publicDir: string,
 *   outputDir: string,
 *   cleanup: () => Promise<void>,
 *   writePage: (name: string, content: string) => Promise<string>,
 *   writeComponent: (name: string, content: string) => Promise<string>,
 *   deletePage: (name: string) => Promise<void>,
 *   writeConfig: (content: string) => Promise<string>,
 *   runBuild: (args?: string[]) => Promise<{ stdout: string, stderr: string, exitCode: number }>
 * }>}
 */
export async function createCLIProject () {
  const testDir = await mkdtemp(path.join(tmpdir(), 'coralite-cli-test-'))
  const pagesDir = path.join(testDir, 'src', 'pages')
  const componentsDir = path.join(testDir, 'src', 'components')
  const publicDir = path.join(testDir, 'public')
  const outputDir = path.join(testDir, 'dist')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await mkdir(publicDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const project = {
    testDir,
    pagesDir,
    componentsDir,
    publicDir,
    outputDir,
    cleanup: async function () {
      return rm(testDir, {
        recursive: true,
        force: true
      })
    },
    writePage: (name, content) => {
      const filePath = path.join(pagesDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    deletePage: (name) => {
      const filePath = path.join(pagesDir, name)
      return rm(filePath)
    },
    writeComponent: (name, content) => {
      const filePath = path.join(componentsDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    writeConfig: (content) => {
      const filePath = path.join(testDir, 'coralite.config.js')
      return writeFile(filePath, content).then(() => filePath)
    },
    runBuild: (args = []) => {
      return new Promise((resolve) => {
        const nodePath = [
          path.resolve(__dirname, '../../node_modules'),
          path.resolve(__dirname, '../../../../node_modules')
        ].join(path.delimiter)

        const child = spawn('node', ['--experimental-vm-modules', binPath, 'build', ...args], {
          cwd: testDir,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            NODE_PATH: nodePath
          }
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', (code) => {
          resolve({
            stdout,
            stderr,
            exitCode: code
          })
        })
      })
    }
  }

  // Write a default config that imports from the local file instead of the package name
  // Use pathToFileURL for better cross-platform compatibility in ESM imports
  const libUrl = pathToFileURL(coraliteScriptsLib).href
  await project.writeConfig(`
    import { defineConfig } from '${libUrl}'
    export default defineConfig({
      output: './dist',
      components: './src/components',
      pages: './src/pages',
      public: './public'
    })
  `)

  return project
}
