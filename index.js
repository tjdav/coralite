#!/usr/bin/env node

import { getHTML, getArgs, getTemplateFromString, mergeTemplateToPage } from './lib/index.js'

/** @import { CoraliteData } from './lib/getTemplateFromString.js' */

const args = getArgs()
const templatesHTML = await getHTML(args.templates)
const pages = await getHTML(args.pages)

/** @type {Object.<string, CoraliteData>} */
const templates = {}

for (let i = 0; i < templatesHTML.length; i++) {
  const html = templatesHTML[i]
  
  getTemplateFromString(html.data, templates)
}

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];
  const result = mergeTemplateToPage(page.data, templates)

  console.log(result)
}