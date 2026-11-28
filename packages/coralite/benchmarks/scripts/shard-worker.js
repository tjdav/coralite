import fs from 'node:fs/promises'
import path from 'node:path'
import { createCoralite } from '../../lib/index.js'

const payload = JSON.parse(process.argv[2])

const app = await createCoralite({
  components: payload.componentsDir,
  pages: payload.pagesDir,
  projectRoot: payload.root,
  output: payload.outputDir,
  cacheDir: payload.cacheDir,
  mode: 'production',
  incremental: true,
  concurrency: payload.concurrency
})

const results = await app.build(null, { dynamicPaths: payload.dynamicPaths })

for (const result of results) {
  if (result.status === 'skipped' || typeof result.content !== 'string') {
    continue
  }
  const relativeDir = path.relative(payload.pagesDir, result.path.dirname)
  const outFile = path.join(payload.outputDir, relativeDir, result.path.filename)
  await fs.mkdir(path.dirname(outFile), { recursive: true })
  await fs.writeFile(outFile, result.content)
}

for (const file of Object.values(app.outputFiles || {})) {
  const isCss = (file.path || file.hashedPath || '').endsWith('.css')
  const baseDir = path.join(payload.outputDir, 'assets', isCss ? 'css' : 'js')
  const outFile = file.outputDir
    ? path.join(payload.outputDir, file.outputDir, file.hashedPath)
    : path.join(baseDir, file.hashedPath)
  await fs.mkdir(path.dirname(outFile), { recursive: true })
  await fs.writeFile(outFile, file.contents !== undefined ? file.contents : file.text)
}

console.log(JSON.stringify({ rendered: results.length }))
