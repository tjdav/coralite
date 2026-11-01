import { copyFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceLlms = resolve(__dirname, '../../../website/public/llms.txt')
const targetLlms = resolve(__dirname, '../llms.txt')
const sourceLlmsFull = resolve(__dirname, '../../../website/public/llms-full.txt')
const targetLlmsFull = resolve(__dirname, '../llms-full.txt')

if (existsSync(sourceLlms)) {
  copyFileSync(sourceLlms, targetLlms)
  console.log('✔ Copied website/public/llms.txt -> packages/coralite/llms.txt')
} else {
  console.warn('⚠️ Could not find source file at website/public/llms.txt')
}

if (existsSync(sourceLlmsFull)) {
  copyFileSync(sourceLlmsFull, targetLlmsFull)
  console.log('✔ Copied website/public/llms-full.txt -> packages/coralite/llms-full.txt')
} else {
  console.warn('⚠️ Could not find source file at website/public/llms-full.txt')
}
