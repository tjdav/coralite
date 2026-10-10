# Module Scope and onError Probe Report

## Component Module Scope

### Output & Findings
- **Getter Renders**: `getter:preserved:preserved`
  - In server evaluation, top-level constants and functions (`MODULE_CONST`, `MODULE_FN`) are preserved in Node.js module scope.
- **Client Console Log**: `[module-scope][client] client:ERR:MODULE_CONST is not defined`
  - The browser client function receives the extracted `client()` script string, where outer module-scope references are lost/undefined.
- **Diagnostics**:
  - `CORALITE-E301`: 2 diagnostics in build
    - `Top-level variable 'MODULE_CONST' referenced inside client() block.`
    - `Top-level variable 'MODULE_FN' referenced inside client() block.`

---

## Plugin Module Scope Re-confirmation

### Output & Findings
Inside plugin `client.context`:
- `moduleConst`: `'ERR:moduleConst is not defined'`
- `moduleFn`: `'ERR:moduleFn is not defined'`
- `hasFileURLToPath`: `'ERR:hasFileURLToPath is not defined'`
- **Diagnostics**:
  - `CORALITE-P301`: 3 diagnostics in build
    - `[Coralite Serialization Error] Plugin "scope-probe-plugin": client.context references outer-scope symbol "moduleConst" which will not be available after serialization. Move this function inside client.context or pass it via client.config.`
    - `[Coralite Serialization Error] Plugin "scope-probe-plugin": client.context references outer-scope symbol "moduleFn" which will not be available after serialization. Move this function inside client.context or pass it via client.config.`
    - `[Coralite Serialization Error] Plugin "scope-probe-plugin": client.context references outer-scope symbol "hasFileURLToPath" which will not be available after serialization. Move this function inside client.context or pass it via client.config.`

---

## onError Shape

### Output & Findings
- **Logged Keys Verbatim**:
```json
[
  "error",
  "state",
  "element",
  "page",
  "root"
]
```
