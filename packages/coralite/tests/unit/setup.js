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

// 1. Spec-compliant ElementInternals polyfill (independent guard)
if (typeof window.HTMLElement.prototype.attachInternals !== 'function') {
  class MockElementInternals {
    constructor (element) {
      this._element = element
      this._formValue = null
      this._validity = {
        valid: true,
        valueMissing: false,
        typeMismatch: false,
        patternMismatch: false,
        tooLong: false,
        tooShort: false,
        rangeUnderflow: false,
        rangeOverflow: false,
        stepMismatch: false,
        badInput: false,
        customError: false
      }
      this._validationMessage = ''
    }

    get form () {
      const formAttr = this._element.getAttribute ? this._element.getAttribute('form') : null
      if (formAttr && this._element.ownerDocument) {
        const targetForm = this._element.ownerDocument.getElementById(formAttr)
        if (targetForm && targetForm.tagName && targetForm.tagName.toLowerCase() === 'form') {
          return targetForm
        }
      }
      return this._element.closest ? (this._element.closest('form') ?? null) : null
    }

    get validity () {
      return this._validity
    }

    get validationMessage () {
      return this._validationMessage
    }

    get willValidate () {
      return true
    }

    setFormValue (value, state) {
      this._formValue = value
    }

    setValidity (flags = {}, message = '', anchor) {
      const hasError = Object.values(flags).some(Boolean)
      this._validity = {
        valid: !hasError,
        valueMissing: Boolean(flags.valueMissing),
        typeMismatch: Boolean(flags.typeMismatch),
        patternMismatch: Boolean(flags.patternMismatch),
        tooLong: Boolean(flags.tooLong),
        tooShort: Boolean(flags.tooShort),
        rangeUnderflow: Boolean(flags.rangeUnderflow),
        rangeOverflow: Boolean(flags.rangeOverflow),
        stepMismatch: Boolean(flags.stepMismatch),
        badInput: Boolean(flags.badInput),
        customError: Boolean(flags.customError)
      }
      this._validationMessage = hasError ? (message || 'Invalid value') : ''
    }

    checkValidity () {
      return this._validity.valid
    }

    reportValidity () {
      return this._validity.valid
    }
  }

  window.HTMLElement.prototype.attachInternals = function () {
    if (!this.constructor.formAssociated) {
      throw new DOMException("Failed to execute 'attachInternals' on 'HTMLElement': The element is not form-associated.", 'NotSupportedError')
    }
    if (this.__internalsAttached) {
      throw new DOMException("Failed to execute 'attachInternals' on 'HTMLElement': An ElementInternals was already attached.", 'NotSupportedError')
    }
    this.__internalsAttached = true
    return new MockElementInternals(this)
  }
  global.ElementInternals = MockElementInternals
}

// 2. FormData custom element collection (independent guard + nested form protection)
const OriginalFormData = window.FormData
if (OriginalFormData) {
  window.FormData = class extends OriginalFormData {
    constructor (form) {
      super(form)
      if (form && typeof form.querySelectorAll === 'function') {
        const customElements = form.querySelectorAll('*')
        for (let i = 0; i < customElements.length; i++) {
          const el = customElements[i]
          if (el.closest && el.closest('form') !== form) continue
          if (el.constructor.formAssociated && el._internals && el._internals._formValue !== null && el.name) {
            this.append(el.name, el._internals._formValue)
          }
        }
      }
    }
  }
  global.FormData = window.FormData
}
