# jsbenchmarks.com Coralite Integration

This benchmark integration targets `jsbenchmarks.com`.

## Requirements & Implementation
- Each row is rendered using the custom `<bench-row>` component instead of raw `<tr>` strings.
- Custom element attribute bindings are managed reactively using Coralite's `lists` plugin and reactive store.
- No manual DOM manipulation or `innerHTML` template injection.

## Build
```sh
pnpm build
```
Outputs static build files to `dist/`.
