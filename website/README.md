# Website Documentation

This package builds the public `coralite.dev` documentation and the machine-readable LLM references.

## Canonical Sources

Keep the detailed contract in one place. Other pages should summarize or link to the canonical owner instead of repeating the full rules.

| Topic | Canonical source | Mirrors / summaries |
|---|---|---|
| Imperative components | `src/pages/docs/reference/imperative-components.html` | JavaScript guide, plugin guide, E2E guide, plugin reference, `AGENTS.md`, `packages/coralite/AGENT.md`, `packages/coralite/README.md`, `public/llms.txt`, `public/llms/plugins.md` |
| DOM refs | `src/pages/docs/guide/dom-refs.html` | Imperative-components reference links here for the full ref model |
| Styling | `src/pages/docs/guide/styling.html` | Imperative-components reference links here for scoped styles and host styling |
| Runtime DOM types | `src/pages/docs/reference/types.html` | Imperative-components reference links here for runtime type signatures |

`public/llms-full.txt` is an intentionally complete standalone LLM reference. It mirrors canonical details instead of linking, so it must be updated when a canonical contract changes.

## Sync Checklist

1. Update the canonical page first.
2. Update `public/llms-full.txt` if the contract changed.
3. Update summaries only when the high-level rule changed.
4. Run `pnpm website:build` from the repository root.
5. Check that canonical anchors and summary links still resolve.

## Build

```bash
pnpm website:build
```

The site is built with Coralite from `src/pages` and `src/components`.
