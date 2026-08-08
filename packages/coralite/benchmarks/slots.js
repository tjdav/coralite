// @ts-nocheck
import { bench, run } from 'mitata'
import { Window } from 'happy-dom'
import { parseModule } from '../lib/utils/server/parse.js'
import { createTestProject } from '../tests/unit/utils/project.js'
import { performance } from 'node:perf_hooks'

// ==========================================
// HAPPY DOM SETUP (For client-side suites)
// ==========================================
const window = new Window()
global.window = window
global.document = window.document
global.HTMLElement = window.HTMLElement
global.customElements = window.customElements
global.Node = window.Node
global.Text = window.Text
global.Comment = window.Comment
global.Document = window.Document
global.DocumentFragment = window.DocumentFragment
global.HTMLSlotElement = window.HTMLSlotElement

console.log('==================================================')
console.log('Coralite Slots Performance Benchmark')
console.log('==================================================')

// ==========================================
// SUITE A: Slot Compilation & Parsing (Server-side)
// ==========================================
const templateNoSlot = `
  <template id="no-slot">
    <div class="card">
      <h3>Card Title</h3>
      <p>This card has no slots and holds static description details.</p>
    </div>
  </template>
`

const templateDefaultSlot = `
  <template id="default-slot">
    <div class="card">
      <h3>Card Title</h3>
      <slot></slot>
    </div>
  </template>
`

const templateNamedSlots = `
  <template id="named-slots">
    <div class="card">
      <header><slot name="header"></slot></header>
      <section><slot></slot></section>
      <footer><slot name="footer"></slot></footer>
    </div>
  </template>
`

const templateDeeplyNestedSlots = `
  <template id="deeply-nested-slots">
    <div class="card">
      <slot name="outer">
        <div class="level-1">
          <slot name="level-1">
            <div class="level-2">
              <slot name="level-2">
                <div class="level-3">
                  <slot name="level-3">
                    <div class="level-4">
                      <slot name="level-4"></slot>
                    </div>
                  </slot>
                </div>
              </slot>
            </div>
          </slot>
        </div>
      </slot>
    </div>
  </template>
`

console.log('\n[Suite A] Parsing and Compilation of Component Templates')
console.log('--------------------------------------------------')

bench('parseModule - No Slots (Baseline)', () => {
  parseModule(templateNoSlot, { ignoreByAttribute: [] })
})

bench('parseModule - Single Default Slot', () => {
  parseModule(templateDefaultSlot, { ignoreByAttribute: [] })
})

bench('parseModule - Multiple Named Slots', () => {
  parseModule(templateNamedSlots, { ignoreByAttribute: [] })
})

bench('parseModule - Deeply Nested Slots (5 levels)', () => {
  parseModule(templateDeeplyNestedSlots, { ignoreByAttribute: [] })
})


// ==========================================
// SUITE B: Slot Tagging & Filtering (Client-side)
// ==========================================
// Helper functions extracted from coralite-element.js
function tagOwnSlots (html, instanceId) {
  const template = document.createElement('template')
  template.innerHTML = html
  const slots = template.content.querySelectorAll('slot')
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (!slot.hasAttribute('data-coralite-owner')) {
      slot.setAttribute('data-coralite-owner', instanceId)
    }
  }
  return template.innerHTML
}

function getOwnSlots (hostElement, ownId) {
  const allSlots = Array.from(hostElement.querySelectorAll('slot'))
  return allSlots.filter(slotEl => {
    if (slotEl.hasAttribute('data-coralite-owner')) {
      return slotEl.getAttribute('data-coralite-owner') === ownId
    }
    // Fallback logic for untagged elements
    let host = slotEl.parentElement
    while (host && host !== hostElement) {
      if (host.tagName && host.tagName.includes('-')) {
        return false
      }
      host = host.parentElement
    }
    return true
  })
}

// Prepare DOM content for getOwnSlots bench
const flatHost = document.createElement('div')
flatHost.setAttribute('data-cid', 'host-1')
flatHost.innerHTML = '<div><slot data-coralite-owner="host-1"></slot></div>'

const nestedHost = document.createElement('div')
nestedHost.setAttribute('data-cid', 'host-1')
nestedHost.innerHTML = `
  <div>
    <slot data-coralite-owner="host-1"></slot>
    <child-comp data-cid="child-1">
      <slot data-coralite-owner="child-1"></slot>
      <slot data-coralite-owner="host-1"></slot>
    </child-comp>
    <slot data-coralite-owner="host-1"></slot>
  </div>
`

console.log('\n[Suite B] Client-Side Slot Tagging & Filtering')
console.log('--------------------------------------------------')

bench('tagOwnSlots - Standard HTML (1 slot)', () => {
  tagOwnSlots('<div><slot></slot></div>', 'comp-1')
})

bench('tagOwnSlots - Deeply Nested HTML (5 levels)', () => {
  tagOwnSlots('<div><slot name="l1"><slot name="l2"><slot name="l3"><slot name="l4"><slot name="l5"></slot></slot></slot></slot></slot></div>', 'comp-1')
})

bench('getOwnSlots - Flat Structure', () => {
  getOwnSlots(flatHost, 'host-1')
})

bench('getOwnSlots - Nested Structure with Custom Element boundaries', () => {
  getOwnSlots(nestedHost, 'host-1')
})


// ==========================================
// SUITE C: End-to-End Isomorphic Slot Projection (Server/Client)
// ==========================================
console.log('\nSetting up E2E Test Project for Slot Projection...')

const project = await createTestProject()

// 1. Write the "no-slot" component
await project.writeComponent('comp-no-slot.html', `
  <template id="comp-no-slot">
    <div class="static-container">
      <h3>Static Card Title</h3>
      <p>This is a completely static card containing some description text to act as a solid rendering baseline.</p>
    </div>
  </template>
`)

// 2. Write the "slotted" component
await project.writeComponent('comp-slotted.html', `
  <template id="comp-slotted">
    <div class="slotted-container">
      <h3>Slotted Card Title</h3>
      <div class="content">
        <slot></slot>
      </div>
    </div>
  </template>
`)

// 3. Write nested slot components for level 1 to 5
for (let i = 1; i <= 5; i++) {
  const childComp = i < 5 ? `<nested-level-${i + 1}><slot></slot></nested-level-${i + 1}>` : `<slot></slot>`
  await project.writeComponent(`nested-level-${i}.html`, `
    <template id="nested-level-${i}">
      <div class="nested-level-${i}-wrapper">
        <span class="level-indicator">Level ${i}</span>
        ${childComp}
      </div>
    </template>
  `)
}

// Write Page 1: Baseline (100 static components)
let baselinePageContent = ''
for (let i = 0; i < 100; i++) {
  baselinePageContent += `<comp-no-slot></comp-no-slot>\n`
}
await project.writePage('baseline.html', `
  <!DOCTYPE html>
  <html>
    <head><title>Baseline</title></head>
    <body>
      ${baselinePageContent}
    </body>
  </html>
`)

// Write Page 2: Slotted (100 slotted components)
let slottedPageContent = ''
for (let i = 0; i < 100; i++) {
  slottedPageContent += `<comp-slotted>Projected child content ${i}</comp-slotted>\n`
}
await project.writePage('slotted.html', `
  <!DOCTYPE html>
  <html>
    <head><title>Slotted</title></head>
    <body>
      ${slottedPageContent}
    </body>
  </html>
`)

// Write Page 3: Nested (20 groups of 5-level nested components, totaling 100 components)
let nestedPageContent = ''
for (let i = 0; i < 20; i++) {
  nestedPageContent += `
    <nested-level-1>
      <span class="deep-target">Deep Target Content ${i}</span>
    </nested-level-1>
  `
}
await project.writePage('nested.html', `
  <!DOCTYPE html>
  <html>
    <head><title>Nested Slotted</title></head>
    <body>
      ${nestedPageContent}
    </body>
  </html>
`)

// Uses development to force re-compiling page inputs on every build call
const coralite = await project.createCoralite({
  output: project.outputDir,
  mode: 'development',
  baseURL: '/'
})

// Warm up compilation cache and script manager context
await coralite.build('baseline.html')
await coralite.build('slotted.html')
await coralite.build('nested.html')

console.log('\n[Suite C] End-to-End Isomorphic Page rendering (100 components)')
console.log('--------------------------------------------------')

// We will measure high-resolution execution time over multiple runs to compare E2E overhead
const ITERATIONS_E2E = 50

let totalBaselineTime = 0
for (let i = 0; i < ITERATIONS_E2E; i++) {
  const start = performance.now()
  await coralite.build('baseline.html')
  totalBaselineTime += (performance.now() - start)
}
const avgBaseline = totalBaselineTime / ITERATIONS_E2E
console.log(`E2E Build - Baseline (100 static components):       ${avgBaseline.toFixed(2)} ms / build`)

let totalSlottedTime = 0
for (let i = 0; i < ITERATIONS_E2E; i++) {
  const start = performance.now()
  await coralite.build('slotted.html')
  totalSlottedTime += (performance.now() - start)
}
const avgSlotted = totalSlottedTime / ITERATIONS_E2E
console.log(`E2E Build - Slotted (100 slotted components):       ${avgSlotted.toFixed(2)} ms / build`)

let totalNestedTime = 0
for (let i = 0; i < ITERATIONS_E2E; i++) {
  const start = performance.now()
  await coralite.build('nested.html')
  totalNestedTime += (performance.now() - start)
}
const avgNested = totalNestedTime / ITERATIONS_E2E
console.log(`E2E Build - Nested Slotted (100 components):        ${avgNested.toFixed(2)} ms / build`)


// Clean up test project files
await project.cleanup()


// ==========================================
// REGRESSION PREVENTION RATIO VERIFICATION
// ==========================================
const ratioSlotted = avgSlotted / avgBaseline
const ratioNested = avgNested / avgBaseline

console.log('\n==================================================')
console.log('REGRESSION PREVENTION CHECKS')
console.log('==================================================')
console.log(`Ratio (Slotted / Baseline): ${ratioSlotted.toFixed(2)}x (Threshold: 3.50x)`)
console.log(`Ratio (Nested / Baseline):  ${ratioNested.toFixed(2)}x (Threshold: 6.00x)`)

if (process.env.CI_PERF_CHECK === 'true') {
  if (ratioSlotted > 3.5) {
    console.error('❌ Regression detected: Slotted component rendering ratio is too high!')
    process.exit(1)
  }
  if (ratioNested > 6.0) {
    console.error('❌ Regression detected: Nested component rendering ratio is too high!')
    process.exit(1)
  }
  console.log('✅ All slot performance checks passed successfully!')
}

// Run mitata suites (A and B)
await run()
