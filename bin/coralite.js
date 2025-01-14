#!/usr/bin/env node

import { getHTML, getComponentFromString, mergeComponentToDocument, getSubDirectory } from '../lib/index.js'
import { Command } from 'commander'
import { resolve, join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
/** @import { CoraliteComponent } from '../lib/component.js' */

const pkg = JSON.parse(readFileSync(`../package.json`, 'utf-8'))
const program = new Command()

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .requiredOption('-c, --components <path>', 'Path to components directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-d, --dry', 'Run in dry-run mode')

program.parse()
program.on('error', (err) => {
  console.error(err)
})

const options = program.opts()
const componentsPath = options.components
const pagesPath = options.pages
const outputDir = options.output
const dryRun = options.dry

const htmlComponents = await getHTML({
  path: componentsPath,
  recursive: true
})
const htmlPages = await getHTML({
  path: pagesPath,
  recursive: true
})

/** @type {Object.<string, CoraliteComponent>} */
const components = {}

for (let i = 0; i < htmlComponents.length; i++) {
  const html = htmlComponents[i]
  const component = getComponentFromString(html.content)
  components[component.id] = component
}

for (let i = 0; i < htmlPages.length; i++) {
  const html = htmlPages[i]

  const content = await mergeComponentToDocument(html, components, {
    pages: resolve(pagesPath),
    components: resolve(componentsPath)
  })

  if (!dryRun) {
    // get pages sub directory
    const subDir = getSubDirectory(pagesPath, html.parentPath)
    const dir = join(outputDir, subDir)

    try {
      if (!existsSync(dir)) {
        // create directory
        mkdirSync(dir)
      }

      writeFileSync(join(dir, html.name), content)
      // file written successfully
    } catch (err) {
      console.error(err)
    }
  } else {
    console.log('Document')
    console.log('Path: ' + join(html.parentPath, html.name))
    console.log('Content')
    console.log(content)
  }
}
