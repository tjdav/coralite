# Coralite Diagnostics & Validation Reference

> Comprehensive guide to Coralite compiler diagnostics, error codes, and auto-fixers.

## 1. Validation Commands

```bash
# Validate all components, pages, and plugins
npx coralite check

# Validate with strict failure on warnings
npx coralite check --strict

# Automatically apply AST fixes to disk
npx coralite fix

# Preview automated fixes without writing to disk
npx coralite fix --dry-run
```

## 2. Common Diagnostic Codes

| Code | Severity | Description | Fix |
| :--- | :--- | :--- | :--- |
| `CORALITE-E101` | Error | Non-primitive type (`Array`, `Object`) in `attributes` schema | Use primitives (`String`, `Number`, `Boolean`). Fetch complex data in `server()` or pass via context. |
| `CORALITE-E102` | Error | Attribute declares both `required: true` and `default` | Remove `default` if the attribute is strictly required. |
| `CORALITE-E103` | Error | Asynchronous attribute `transform` or `validate` function | Make attribute coercion functions synchronous. |
| `CORALITE-E105` | Error | Context parameter misuse (e.g. (state) => state.prop, deprecated context.attributes, or legacy 2-arg slots) | Destructure ({ state }), use (context) => context.state.prop, or migrate slots to single parameter. |
| `CORALITE-E108` | Error | Bare named exports in a page file (`src/pages/*.html`) | Wrap page exports in `export default definePage({ ... })`. |
| `CORALITE-E201` | Error | Non-flat identifier expression in `<template>` (`{{ a + b }}`) | Move expressions into a synchronous derived getter in `export const getters = { ... }`. |
| `CORALITE-E203` | Error | Inline event handler attribute in `<template>` (`onclick="..."`) | Use `ref="btn"` in template and wire with `refs('btn').addEventListener('click', fn, { signal })` in `client()`. |
| `CORALITE-E301` | Error | Module-scope static import referenced inside `client()` | Use dynamic `await import(...)` inside `client()`. |
| `CORALITE-E302` | Error | State mutated inside `observe()` callback | Mutate state in event listeners or compute values via `getters`. `observe()` is strictly for external side-effects. |
| `CORALITE-E303` | Error | Asynchronous getter function in `export const style` | Make the style function synchronous. |
| `CORALITE-E304` | Error | Node runtime global referenced inside `client()` block | Web-platform globals (`console`, `fetch`, `URL`, ...) are shared and allowed. Fetch build-time data in `server()` or `paths()` and pass it through `state`. |
| `CORALITE-W501` | Warning | Reserved prefix (`coralite-`, `c-`, `router-`) used in component tag ID | Use application prefixes like `site-`, `ui-`, or `app-`. |
| `CORALITE-PAGE-201` | Error | Page script directly queries custom element internals | Communicate via declarative attributes, events, or W3C contexts. |
