#!/usr/bin/env node

import { getHTML, getArgs, getTemplateFromHTML, mergeTemplateToPage } from './lib/index.js'

const args = getArgs()
const templatesHTML = await getHTML(args.templates)
const pages = await getHTML(args.pages)

/** @type {Object.<string, string>} */
const templates = {}

for (let i = 0; i < templatesHTML.length; i++) {
  const html = templatesHTML[i]
  
  getTemplateFromHTML(html.data, templates)
}

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];
  const result = mergeTemplateToPage(page.data, templates)

  console.log(result)
}