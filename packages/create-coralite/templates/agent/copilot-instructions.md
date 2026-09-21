# GitHub Copilot Instructions — Coralite (v{{ version }})

When generating or editing Coralite components (`src/components/*.html`):

1. **Templates (`<template id="comp-name">`)**:
   - Use flat string tokens: `{{ title }}`.
   - Do NOT use JavaScript expressions (`{{ count + 1 }}`), dot access (`{{ user.name }}`), or inline handlers (`onclick="..."`).

2. **Component Definition (`defineComponent`)**:
   - Attribute schema: `attributes: { name: String, count: Number, active: Boolean }`.
   - Pure derived getters: `getters: { doubleCount ({ state }) { return state.count * 2 } }`.
   - Lifecycle: `server({ state })` for build-time, `client({ refs, signal })` for browser runtime.

3. **Client Boundary**:
   - Do NOT reference top-level imports or outer variables inside `client()`. It will be stringified and executed in the browser.
