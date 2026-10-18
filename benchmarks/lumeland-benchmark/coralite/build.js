import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

async function main () {
  const contentDir = join(process.cwd(), 'content')
  const pagesDir = join(process.cwd(), 'pages')
  const componentsDir = join(process.cwd(), 'components')
  const publicDir = join(process.cwd(), 'public')

  // 1. Prepare the directories
  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await mkdir(publicDir, { recursive: true })

  // 2. Read all markdown files from the benchmark generator
  const files = await readdir(contentDir)

  // 3. Convert each file to a Coralite page
  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const slug = file.replace('.md', '')
    const content = await readFile(join(contentDir, file), 'utf-8')

    // Minimal HTML template wrapping the markdown content
    // (For the benchmark, we don't need a full markdown parser,
    // just enough to output the raw text in a page)
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${slug}</title>
</head>
<body>
  <main>
    <h1>${slug}</h1>
    <div class="content">${content.replace(/\n/g, '<br>')}</div>
  </main>
</body>
</html>
`
    await writeFile(join(pagesDir, `${slug}.html`), html)
  }

  // 4. Run Coralite's build
  const binDir = join(process.cwd(), 'node_modules', '.bin')
  const pathEnv = `${binDir}:${process.env.PATH || ''}`
  execSync('coralite build', {
    stdio: 'inherit',
    env: { ...process.env, PATH: pathEnv }
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
