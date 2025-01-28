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
  .requiredOption('-t, --templates <path>', 'Path to templates directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-d, --dry', 'Run in dry-run mode')

program.parse(process.argv)
program.on('error', (err) => {
  console.error(err)
})

const options = program.opts()
const templatesPath = options.templates
const pagesPath = options.pages
const outputDir = options.output
const dryRun = options.dry

const htmlTemplates = await getHTML({
  path: templatesPath,
  recursive: true
})
const htmlPages = await getHTML({
  path: pagesPath,
  recursive: true
})

/** @type {Object.<string, CoraliteModule>} */
const coraliteModules = {}

// create templates
for (let i = 0; i < htmlTemplates.length; i++) {
  const html = htmlTemplates[i]
  const coraliteModule = parseModule(html.content)

  coraliteModules[coraliteModule.id] = coraliteModule
}

for (let i = 0; i < htmlPages.length; i++) {
  const html = htmlPages[i]
  const document = parseHTMLDocument(html, {
    pages: pagesPath,
    templates: templatesPath
  })

  for (let i = 0; i < document.customElements.length; i++) {
    const customElement = document.customElements[i]
    const component = await createComponent({
      id: customElement.name,
      values: customElement.attribs,
      element: customElement,
      components: coraliteModules,
      document
    })

    for (let i = 0; i < component.children.length; i++) {
      // update component parent
      component.children[i].parent = customElement.parent
    }
    const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
    // replace custom element with template
    customElement.parent.children.splice(index, 1, ...component.children)
  }

  // render document
  // @ts-ignore
  const content = render(document.root)

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
