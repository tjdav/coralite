# Coralite Serialization Boundary & Isomorphic Model

> Deep dive into Coralite's build-time SSR, browser serialization, and isomorphic state sharing.

## 1. The Core Architectural Boundary

Coralite separates component logic cleanly between build time and client runtime:

| Stage | Scope | Environment | Bundle Status |
| :--- | :--- | :--- | :--- |
| **`server()`** | Build / SSR | Node.js (>=22.22.2) | Completely stripped from client bundles |
| **`client()`** | Client Runtime | Browser ESM | Serialized into runtime script tag |
| **`getters`, `style`, `slots`** | Isomorphic | Node.js & Browser | Compiled for both SSR and client reactivity |

## 2. Invariants

1. **Client Isolation (`CORALITE-E301`)**: `client()` is serialized and executed in isolation in the browser. It cannot close over module-scope variables or top-level static `import` declarations.
2. **Dynamic Imports in Client**: Any external libraries required in the browser must be dynamically imported inside `client()` using `await import(...)`:
   ```javascript
   export async function client ({ refs, signal }) {
     const { default: confetti } = await import('https://esm.sh/canvas-confetti')
     refs('celebrate').addEventListener('click', () => confetti(), { signal })
   }
   ```
3. **Data Hydration Bridge**: Data produced on the server (database queries, filesystem reads, API calls) is transferred to the client by returning an object from `server()`. This object is serialized into the component's initial state:
   ```javascript
   export async function server () {
     const fs = await import('node:fs/promises')
     const data = await fs.readFile('./data.json', 'utf8')
     return {
       items: JSON.parse(data)
     }
   }
   ```
4. **No Browser Globals in Deterministic Blocks**:
   * Do not check `if (typeof window === 'undefined')` in `client()` (it is always running in the browser).
   * Do not check `if (typeof window !== 'undefined')` in `server()` (it is always running in Node.js).
   * In isomorphic `getters`, use the framework-provided `{ isServer }` flag:
     ```javascript
     export const getters = {
       runtimeLabel: ({ isServer }) => (isServer ? 'SSR' : 'Hydrated')
     }
     ```
