# Claude Code Project Guidelines — Coralite (v{{ version }})

Refer to `AGENTS.md` for full architectural details. Quick summary for Claude Code:

## Core Invariants

1. **Flat Tokens Only in `<template>`**: `{{ token }}` placeholders only. No logic or expressions in HTML.
2. **Client Serialization Boundary**: Code inside `client()` is stringified and sent to the browser. Never close over module-scope variables or top-level imports inside `client()`.
3. **Primitive Attributes Only**: Attributes are `String`, `Number`, or `Boolean`. Never `Object` or `Array`.
4. **Clean Getters**: `getters` are pure derived functions. Always destructure context like `({ state }) => ...`.

## Commands

- `npm start` — Start development server
- `npm run build` — Build production site
- `npx coralite check` — Validate components, plugins, and pages
- `npx coralite fix` — Auto-fix safe component issues
