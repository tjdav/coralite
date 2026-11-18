export {}

declare global {
  interface Window {
    /**
     * Same-document navigation marker set by the Playwright specs to prove
     * that a client-side navigation did not reload the document.
     */
    __sameDocument?: boolean
  }

  interface CSSStyleDeclaration {
    /** WebKit-prefixed backdrop filter, read by the effects spec. */
    webkitBackdropFilter?: string
  }
}
