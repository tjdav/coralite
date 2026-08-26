import { copyFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceLlms = resolve(__dirname, '../../../website/public/llms.txt')
const targetLlms = resolve(__dirname, '../llms.txt')

if (existsSync(sourceLlms)) {
  copyFileSync(sourceLlms, targetLlms)
  console.log('✔ Copied website/public/llms.txt -> packages/coralite/llms.txt')
} else {
  console.warn('⚠️ Could not find source file at website/public/llms.txt')
}
