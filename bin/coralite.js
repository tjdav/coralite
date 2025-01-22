#!/usr/bin/env node

import { render } from 'dom-serializer'
import { getHTML, parseHTMLDocument, parseModule, createComponent, getSubDirectory } from '#lib'
import { Command } from 'commander'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'

/**
 * @import { CoraliteModule } from '#types'
 */

const pkg = JSON.parse(readFileSync(`./package.json`, 'utf-8'))
const program = new Command()

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .requiredOption('-c, --components <path>', 'Path to components directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-d, --dry', 'Run in dry-run mode')

if (!process.env.NODE_OPTIONS.includes('--experimental-vm-modules')) {
  console.log('--experimental-vm-modules')
}

program.parse(process.argv)
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

/** @type {Object.<string, CoraliteModule>} */
const components = {}

// create components
for (let i = 0; i < htmlComponents.length; i++) {
  const html = htmlComponents[i]
  const component = parseModule(html.content)

  components[component.id] = component
}

for (let i = 0; i < htmlPages.length; i++) {
  const html = htmlPages[i]
  const document = parseHTMLDocument(html, {
    pages: pagesPath,
    components: componentsPath
  })

  for (let i = 0; i < document.customElements.length; i++) {
    const customElement = document.customElements[i]
    const component = await createComponent({
      id: customElement.name,
      values: customElement.attribs,
      customElementSlots: document.customElementSlots,
      components,
      document
    })

    // replace custom element with component
    customElement.parent.children.splice(customElement.parentChildIndex, 1, ...component.children)
    component.parent = customElement.parent
  }

  // render document
  // @ts-ignore
  const content = render(document.nodes)

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
