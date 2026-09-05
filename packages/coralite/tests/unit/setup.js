import { Window } from 'happy-dom'

const window = new Window()

// Set up global environment
global.window = window
global.document = window.document
global.Element = window.Element
global.HTMLElement = window.HTMLElement
global.ShadowRoot = window.ShadowRoot
global.customElements = window.customElements
global.Node = window.Node
global.Text = window.Text
global.Comment = window.Comment
global.Document = window.Document
global.DocumentFragment = window.DocumentFragment
global.MutationObserver = window.MutationObserver
global.HTMLSlotElement = window.HTMLSlotElement
global.Event = window.Event
global.CustomEvent = window.CustomEvent

// Ensure queueMicrotask is available (it is in Node.js >= 11, but just in case)
if (typeof global.queueMicrotask !== 'function') {
  global.queueMicrotask = (cb) => Promise.resolve().then(cb)
}

// Optional: If we want to support things like fetch in tests
global.fetch = window.fetch.bind(window)
