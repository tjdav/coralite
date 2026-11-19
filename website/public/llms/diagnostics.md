# Coralite Diagnostics & Validation Reference

> Every diagnostic code Coralite can emit, with severity, auto-fix availability and fix guidance. The canonical, always-current version lives at https://coralite.dev/reference/diagnostics/ and ships with the framework as `DIAGNOSTIC_CATALOG`.

## 1. Validation Commands

```bash
# Validate all components, pages, and plugins
npx coralite check

# Filter to the codes you are working on
npx coralite check --code E201 E202 --only-failed

# Fail the build on warnings too
npx coralite check --strict

# Machine-readable report for CI or an agent
npx coralite check --format json

# Apply or preview automatic AST fixes
npx coralite fix
npx coralite fix --dry-run
npx coralite fix --code E201
```

## 2. The Catalogue

Query the same data from the terminal:

```bash
coralite diagnostics
coralite diagnostics --family plugin --fixable
coralite diagnostics --format json
```

Coralite emits 52 codes across five domains: component (24), plugin (17), accessibility (4), page (4) and configuration (3). Severity is either `error` (fails the build) or `warning` (reported, fails only under `--strict`). Twelve codes are auto-fixable.

| Code | Severity | Auto-fix | Diagnostic | Meaning and fix |
| :--- | :--- | :--- | :--- | :--- |
| `CORALITE-A101` | warning | no | Image missing alt text | A template <img> has no alt attribute. Add a descriptive alt, or alt="" when the image is decorative. |
| `CORALITE-A102` | warning | no | Link without accessible text | An <a> element has no text content and no aria-label. Add visible text, or an aria-label that describes the destination. |
| `CORALITE-A103` | warning | no | ARIA attribute unsupported by role | An aria-* attribute is not permitted on the element role. Remove the attribute, choose the role that supports it, or use the element the role implies. |
| `CORALITE-A105` | warning | no | Nested interactive element | An interactive element is nested inside another interactive element. Split the nesting: use a non-interactive wrapper, or make only one element focusable. |
| `CORALITE-CFG-001` | error | no | Unknown CSP mode key | A key in csp.modes is not one of development, testing or production. Rename the mode key to a supported environment name. |
| `CORALITE-CFG-002` | error | no | Recursive CSP modes | A csp.modes entry declares a nested modes key. Move the directives directly onto the mode object; modes cannot nest. |
| `CORALITE-CFG-003` | error | no | Unknown CSP configuration key | A csp.modes entry contains a key that is not a valid CSP option. Use a supported CSP key such as enabled, directives or externalStyles. |
| `CORALITE-E101` | error | no | Blocked attribute type | An attribute declares Array or Object as its type. Use String, Number or Boolean and pass structured data through server() and state. |
| `CORALITE-E102` | error | yes | Attribute declares required and default | An attribute sets required: true and also declares a default value. Keep required for mandatory attributes, or keep default and drop required. |
| `CORALITE-E103` | error | no | Asynchronous attribute handler | An attribute transform or validate function is asynchronous. Make attribute coercion synchronous; fetch asynchronous data in server(). |
| `CORALITE-E104` | error | no | Reserved context key collision | A state property or context key collides with a framework-reserved name. Rename the property so it does not shadow state, refs, signal, emit, root or observe. |
| `CORALITE-E105` | error | yes | Invalid context shape | A getter, style or slots handler uses the wrong parameter shape, context.attributes, or legacy arguments. Destructure ({ state }) or take the context object and read context.state. |
| `CORALITE-E106` | error | yes | Invalid provide or consume option | provide must be an object or Map, and consume must use a supported shape. Declare provide as an object or new Map(), and consume as an array or keyed object. |
| `CORALITE-E107` | error | no | Invalid option or unknown block | A component option has the wrong value, or a plugin declares an unknown block. Use a boolean for formAssociated/formControl, a valid listStrategy, and only documented plugin blocks. |
| `CORALITE-E109` | error | no | CSS import outside client() | A .css file is imported at module scope, outside client(), or with unsupported options. Load stylesheets inside client() with await import('pkg/styles.css', options). |
| `CORALITE-E201` | error | yes | Complex template expression | A template token contains an expression instead of a flat identifier. Move the expression into a synchronous getter and reference the getter name. |
| `CORALITE-E202` | error | yes | Missing template ref | client() calls refs() for a name that no template element declares. Add ref="name" to the element, or call the ref that exists. |
| `CORALITE-E203` | error | yes | Inline event handler | A template element uses an inline on* attribute, which violates the CSP contract. Add a ref and bind the listener in client() with { signal }. |
| `CORALITE-E204` | error | no | Missing or invalid template id | The <template> has no id, or the id is not a valid custom element name. Give the template a hyphenated id such as <template id="ui-card">. |
| `CORALITE-E205` | error | no | Unresolved template token | A {{ token }} does not resolve to an attribute, state property or getter. Declare the symbol in attributes, server() state, or getters, and check spelling. |
| `CORALITE-E301` | error | yes | Module-scope import in client() | client() references a variable bound by a static top-level import. Use await import() inside client() so the module is not serialized by reference. |
| `CORALITE-E302` | warning | no | State mutated in observe() | An observe() callback assigns reactive state, which can loop indefinitely. Mutate state in event handlers; use observe() only for external side effects. |
| `CORALITE-E303` | error | no | Asynchronous style getter | A style function is async. Style functions must be synchronous; derive the value from state instead. |
| `CORALITE-E304` | error | no | Node global in client() | client() references a Node-only runtime global such as process or Buffer. Use browser APIs, or fetch build-time data in server() and pass it through state. |
| `CORALITE-E401` | warning | no | HTTP request global in server() | server() references request or response identifiers that Coralite does not provide. Read route params and configuration from the context instead of HTTP globals. |
| `CORALITE-E402` | error | no | Invalid page paths() result | A page paths() block returned something other than an array of parameter objects. Return an array whose entries provide every declared route parameter. |
| `CORALITE-E403` | error | no | Unresolvable stylesheet | A dynamic .css import points to a file or package that cannot be resolved. Check the relative path or package name, and confirm the file exists on disk. |
| `CORALITE-E407` | error | no | Invalid plugin paths() result | A plugin onPageSet hook returned a paths value that is not an array. Return an array of parameter objects from onPageSet, or omit paths. |
| `CORALITE-P101` | error | no | Missing plugin name | definePlugin() has no name, or the name is not a non-empty string. Add a unique, non-empty name to the plugin definition. |
| `CORALITE-P102` | error | no | Reserved plugin name | The plugin name collides with a core plugin or a reserved runtime key. Rename the plugin so it does not shadow metadata, refs, testing or another core key. |
| `CORALITE-P201` | error | yes | Single-phase context resolver | server.context or client.context returns an object instead of a resolver function. Return (instanceContext) => ({ ... }) from the first phase. |
| `CORALITE-P202` | error | no | Invalid server hook or property | The server block declares an unknown property or a hook that is not a function. Use a documented hook name and give it a function value. |
| `CORALITE-P203` | error | no | Server-only import in client block | A client block imports a Node-only module such as node:fs. Move the import into the server block or load it dynamically where it is valid. |
| `CORALITE-P204` | error | no | Invalid modes declaration | The plugin modes property is not a non-empty array of known mode names. Declare modes as an array such as ['development', 'production']. |
| `CORALITE-P205` | error | no | Invalid dependencies declaration | The dependencies property is not an array of plugin names. List plugin names as an array of non-empty strings. |
| `CORALITE-P206` | error | no | Invalid plugin config schema | A plugin config declaration uses an unsupported type, or still uses depends. Use String, Number, Boolean, Object or Array, and rename depends to dependencies. |
| `CORALITE-P207` | error | no | Invalid plugin config value | A call-time config value is unknown, missing when required, or the wrong type. Pass only declared keys with values that match the declared schema. |
| `CORALITE-P209` | error | no | Reassigned config.clientConfig | The plugin config proxy forbids replacing clientConfig as a whole. Write to config.clientConfig.<key> instead of assigning the object. |
| `CORALITE-P210` | error | no | Non-serializable client config | client.config contains functions, circular references or other non-JSON values. Keep client.config to plain serializable data and move behaviour into hooks. |
| `CORALITE-P211` | error | no | Mixed context declarations | A plugin declares top-level context together with server.context or client.context. Use top-level context for ambient helpers, or environment-specific context, never both. |
| `CORALITE-P301` | error | no | Outer scope leak in client code | A serialized plugin client function references a module-scope variable. Move the value into client.config or resolve it inside the function. |
| `CORALITE-P302` | error | no | Function-valued client.config | client.config is declared as a function instead of a serializable object. Declare client.config as a plain object of serializable values. |
| `CORALITE-P303` | error | no | Invalid client hook or property | The client block declares an unknown property or a deprecated hook. Use documented client hooks such as onBeforeComponentRender, and give them functions. |
| `CORALITE-P401` | error | yes | Missing definePlugin wrapper | The plugin exports a bare object instead of calling definePlugin(). Wrap the configuration in export default definePlugin({ ... }). |
| `CORALITE-PAGE-101` | warning | no | Unknown custom element | A page uses a custom element tag that no component defines. Register the component, fix the tag spelling, or remove the element. |
| `CORALITE-PAGE-102` | error | yes | Missing required attribute | A page tag omits an attribute the component marks as required. Add the attribute with a valid value, or relax required in the component schema. |
| `CORALITE-PAGE-201` | error | no | Page reaches into component internals | A page script queries or mutates DOM inside a custom element instance. Communicate through attributes, events or context instead of internal nodes. |
| `CORALITE-W204` | warning | yes | Redundant ref existence guard | client() checks whether a template ref exists, but refs are guaranteed at mount. Use the ref directly and bind with { signal } for lifecycle cleanup. |
| `CORALITE-W401` | warning | no | Unused declaration | A getter, server state property or attribute declaration is never used. Remove the declaration or reference it from the template or a handler. |
| `CORALITE-W402` | warning | yes | Unused template ref | An element declares ref="name" but no handler reads it. Remove the ref, or add the coralite-ignore pragma while wiring it up in a later step. |
| `CORALITE-W501` | warning | no | Reserved tag prefix | A component tag uses a reserved prefix such as coralite-, c- or router-. Use a project prefix such as site-, ui- or app-. |
| `CORALITE-W601` | error | no | Defensive guard on framework context | Code guards a context key or global that the framework guarantees, hiding real errors. Remove the guard; if the value is missing the bug is in configuration or the build. |

## 3. Ignore Pragmas

- `<!-- coralite-ignore E201 -->` silences one code for the component (or page element) it is placed in.
- `/* coralite-ignore E201 */` does the same inside a script block.
- `<!-- coralite-ignore symbolName -->` suppresses unused-symbol warnings for that symbol.
- Config, route and stylesheet errors abort the build and cannot be ignored.
