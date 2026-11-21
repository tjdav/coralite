/**
 * @typedef {'component' | 'plugin' | 'page' | 'accessibility' | 'config'} DiagnosticFamily
 * @typedef {'error' | 'warning'} DiagnosticSeverity
 * @typedef {object} DiagnosticCatalogEntry
 * @property {string} code - Canonical diagnostic code, e.g. `CORALITE-E201`.
 * @property {string} title - Short human-readable name.
 * @property {DiagnosticFamily} family - Validation domain that emits the code.
 * @property {DiagnosticSeverity} severity - Whether the code fails a build or only warns.
 * @property {boolean} fixable - Whether `coralite fix` can repair it automatically.
 * @property {string[]} [fixActions] - AST fixer actions applied for a fixable code.
 * @property {string} summary - What the diagnostic means and when it fires.
 * @property {string} fix - How to resolve it.
 */

/**
 * Machine-readable catalogue of every diagnostic Coralite can emit.
 *
 * The catalogue is documentation, not validation: rules keep emitting their
 * codes directly. A unit test asserts this list and the emitted codes stay in
 * sync, so `coralite diagnostics`, the website reference and the runtime never
 * disagree.
 *
 * @type {DiagnosticCatalogEntry[]}
 */
export const DIAGNOSTIC_CATALOG = [
  {
    code: 'CORALITE-A101',
    title: 'Image missing alt text',
    family: 'accessibility',
    severity: 'warning',
    fixable: false,
    summary: 'A template <img> has no alt attribute.',
    fix: 'Add a descriptive alt, or alt="" when the image is decorative.'
  },
  {
    code: 'CORALITE-A102',
    title: 'Link without accessible text',
    family: 'accessibility',
    severity: 'warning',
    fixable: false,
    summary: 'An <a> element has no text content and no aria-label.',
    fix: 'Add visible text, or an aria-label that describes the destination.'
  },
  {
    code: 'CORALITE-A103',
    title: 'ARIA attribute unsupported by role',
    family: 'accessibility',
    severity: 'warning',
    fixable: false,
    summary: 'An aria-* attribute is not permitted on the element role.',
    fix: 'Remove the attribute, choose the role that supports it, or use the element the role implies.'
  },
  {
    code: 'CORALITE-A105',
    title: 'Nested interactive element',
    family: 'accessibility',
    severity: 'warning',
    fixable: false,
    summary: 'An interactive element is nested inside another interactive element.',
    fix: 'Split the nesting: use a non-interactive wrapper, or make only one element focusable.'
  },
  {
    code: 'CORALITE-CFG-001',
    title: 'Unknown CSP mode key',
    family: 'config',
    severity: 'error',
    fixable: false,
    summary: 'A key in csp.modes is not one of development, testing or production.',
    fix: 'Rename the mode key to a supported environment name.'
  },
  {
    code: 'CORALITE-CFG-002',
    title: 'Recursive CSP modes',
    family: 'config',
    severity: 'error',
    fixable: false,
    summary: 'A csp.modes entry declares a nested modes key.',
    fix: 'Move the directives directly onto the mode object; modes cannot nest.'
  },
  {
    code: 'CORALITE-CFG-003',
    title: 'Unknown CSP configuration key',
    family: 'config',
    severity: 'error',
    fixable: false,
    summary: 'A csp.modes entry contains a key that is not a valid CSP option.',
    fix: 'Use a supported CSP key such as enabled, directives or externalStyles.'
  },
  {
    code: 'CORALITE-E101',
    title: 'Blocked attribute type',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'An attribute declares Array or Object as its type.',
    fix: 'Use String, Number or Boolean and pass structured data through server() and state.'
  },
  {
    code: 'CORALITE-E102',
    title: 'Attribute declares required and default',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['strip_default'],
    summary: 'An attribute sets required: true and also declares a default value.',
    fix: 'Keep required for mandatory attributes, or keep default and drop required.'
  },
  {
    code: 'CORALITE-E103',
    title: 'Asynchronous attribute handler',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'An attribute transform or validate function is asynchronous.',
    fix: 'Make attribute coercion synchronous; fetch asynchronous data in server().'
  },
  {
    code: 'CORALITE-E104',
    title: 'Reserved context key collision',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A state property or context key collides with a framework-reserved name.',
    fix: 'Rename the property so it does not shadow state, refs, signal, emit, root or observe.'
  },
  {
    code: 'CORALITE-E105',
    title: 'Invalid context shape',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['rewrite_context_attributes', 'rewrite_getter_context', 'style_context_migration', 'slots_context_migration'],
    summary: 'A getter, style or slots handler uses the wrong parameter shape, context.attributes, or legacy arguments.',
    fix: 'Destructure ({ state }) or take the context object and read context.state.'
  },
  {
    code: 'CORALITE-E106',
    title: 'Invalid provide or consume option',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['convert_to_object', 'convert_to_array'],
    summary: 'provide must be an object or Map, and consume must use a supported shape.',
    fix: 'Declare provide as an object or new Map(), and consume as an array or keyed object.'
  },
  {
    code: 'CORALITE-E107',
    title: 'Invalid option or unknown block',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A component option has the wrong value, or a plugin declares an unknown block.',
    fix: 'Use a boolean for formAssociated/formControl, a valid listStrategy, and only documented plugin blocks.'
  },
  {
    code: 'CORALITE-E109',
    title: 'CSS import outside client()',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A .css file is imported at module scope, outside client(), or with unsupported options.',
    fix: 'Load stylesheets inside client() with await import(\'pkg/styles.css\', options).'
  },
  {
    code: 'CORALITE-E201',
    title: 'Complex template expression',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['lift_to_getter'],
    summary: 'A template token contains an expression instead of a flat identifier.',
    fix: 'Move the expression into a synchronous getter and reference the getter name.'
  },
  {
    code: 'CORALITE-E202',
    title: 'Missing template ref',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['inject_ref'],
    summary: 'client() calls refs() for a name that no template element declares.',
    fix: 'Add ref="name" to the element, or call the ref that exists.'
  },
  {
    code: 'CORALITE-E203',
    title: 'Inline event handler',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['remove_attribute'],
    summary: 'A template element uses an inline on* attribute, which violates the CSP contract.',
    fix: 'Add a ref and bind the listener in client() with { signal }.'
  },
  {
    code: 'CORALITE-E204',
    title: 'Missing or invalid template id',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'The <template> has no id, or the id is not a valid custom element name.',
    fix: 'Give the template a hyphenated id such as <template id="ui-card">.'
  },
  {
    code: 'CORALITE-E205',
    title: 'Unresolved template token',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A {{ token }} does not resolve to an attribute, state property or getter.',
    fix: 'Declare the symbol in attributes, server() state, or getters, and check spelling.'
  },
  {
    code: 'CORALITE-E301',
    title: 'Module-scope import in client()',
    family: 'component',
    severity: 'error',
    fixable: true,
    fixActions: ['dynamic_import'],
    summary: 'client() references a variable bound by a static top-level import.',
    fix: 'Use await import() inside client() so the module is not serialized by reference.'
  },
  {
    code: 'CORALITE-E302',
    title: 'State mutated in observe()',
    family: 'component',
    severity: 'warning',
    fixable: false,
    summary: 'An observe() callback assigns reactive state, which can loop indefinitely.',
    fix: 'Mutate state in event handlers; use observe() only for external side effects.'
  },
  {
    code: 'CORALITE-E303',
    title: 'Asynchronous style getter',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A style function is async.',
    fix: 'Style functions must be synchronous; derive the value from state instead.'
  },
  {
    code: 'CORALITE-E304',
    title: 'Node global in client()',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'client() references a Node-only runtime global such as process or Buffer.',
    fix: 'Use browser APIs, or fetch build-time data in server() and pass it through state.'
  },
  {
    code: 'CORALITE-E401',
    title: 'HTTP request global in server()',
    family: 'component',
    severity: 'warning',
    fixable: false,
    summary: 'server() references request or response identifiers that Coralite does not provide.',
    fix: 'Read route params and configuration from the context instead of HTTP globals.'
  },
  {
    code: 'CORALITE-E402',
    title: 'Invalid page paths() result',
    family: 'page',
    severity: 'error',
    fixable: false,
    summary: 'A page paths() block returned something other than an array of parameter objects.',
    fix: 'Return an array whose entries provide every declared route parameter.'
  },
  {
    code: 'CORALITE-E403',
    title: 'Unresolvable stylesheet',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'A dynamic .css import points to a file or package that cannot be resolved.',
    fix: 'Check the relative path or package name, and confirm the file exists on disk.'
  },
  {
    code: 'CORALITE-E404',
    title: 'Invalid page cacheKey() result',
    family: 'page',
    severity: 'error',
    fixable: false,
    summary: 'A page cacheKey() block returned something other than a string or number.',
    fix: 'Return a stable string or number that changes when the rendered output changes.'
  },
  {
    code: 'CORALITE-E407',
    title: 'Invalid plugin paths() result',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A plugin onPageSet hook returned a paths value that is not an array.',
    fix: 'Return an array of parameter objects from onPageSet, or omit paths.'
  },
  {
    code: 'CORALITE-P101',
    title: 'Missing plugin name',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'definePlugin() has no name, or the name is not a non-empty string.',
    fix: 'Add a unique, non-empty name to the plugin definition.'
  },
  {
    code: 'CORALITE-P102',
    title: 'Reserved plugin name',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The plugin name collides with a core plugin or a reserved runtime key.',
    fix: 'Rename the plugin so it does not shadow metadata, refs, testing or another core key.'
  },
  {
    code: 'CORALITE-P201',
    title: 'Single-phase context resolver',
    family: 'plugin',
    severity: 'error',
    fixable: true,
    fixActions: ['wrap_two_phase_context'],
    summary: 'server.context or client.context returns an object instead of a resolver function.',
    fix: 'Return (instanceContext) => ({ ... }) from the first phase.'
  },
  {
    code: 'CORALITE-P202',
    title: 'Invalid server hook or property',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The server block declares an unknown property or a hook that is not a function.',
    fix: 'Use a documented hook name and give it a function value.'
  },
  {
    code: 'CORALITE-P203',
    title: 'Server-only import in client block',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A client block imports a Node-only module such as node:fs.',
    fix: 'Move the import into the server block or load it dynamically where it is valid.'
  },
  {
    code: 'CORALITE-P204',
    title: 'Invalid modes declaration',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The plugin modes property is not a non-empty array of known mode names.',
    fix: 'Declare modes as an array such as [\'development\', \'production\'].'
  },
  {
    code: 'CORALITE-P205',
    title: 'Invalid dependencies declaration',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The dependencies property is not an array of plugin names.',
    fix: 'List plugin names as an array of non-empty strings.'
  },
  {
    code: 'CORALITE-P206',
    title: 'Invalid plugin config schema',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A plugin config declaration uses an unsupported type, or still uses depends.',
    fix: 'Use String, Number, Boolean, Object or Array, and rename depends to dependencies.'
  },
  {
    code: 'CORALITE-P207',
    title: 'Invalid plugin config value',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A call-time config value is unknown, missing when required, or the wrong type.',
    fix: 'Pass only declared keys with values that match the declared schema.'
  },
  {
    code: 'CORALITE-P209',
    title: 'Reassigned config.clientConfig',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The plugin config proxy forbids replacing clientConfig as a whole.',
    fix: 'Write to config.clientConfig.<key> instead of assigning the object.'
  },
  {
    code: 'CORALITE-P210',
    title: 'Non-serializable client config',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'client.config contains functions, circular references or other non-JSON values.',
    fix: 'Keep client.config to plain serializable data and move behaviour into hooks.'
  },
  {
    code: 'CORALITE-P211',
    title: 'Mixed context declarations',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A plugin declares top-level context together with server.context or client.context.',
    fix: 'Use top-level context for ambient helpers, or environment-specific context, never both.'
  },
  {
    code: 'CORALITE-P301',
    title: 'Outer scope leak in client code',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'A serialized plugin client function references a module-scope variable.',
    fix: 'Move the value into client.config or resolve it inside the function.'
  },
  {
    code: 'CORALITE-P302',
    title: 'Function-valued client.config',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'client.config is declared as a function instead of a serializable object.',
    fix: 'Declare client.config as a plain object of serializable values.'
  },
  {
    code: 'CORALITE-P303',
    title: 'Invalid client hook or property',
    family: 'plugin',
    severity: 'error',
    fixable: false,
    summary: 'The client block declares an unknown property or a deprecated hook.',
    fix: 'Use documented client hooks such as onBeforeComponentRender, and give them functions.'
  },
  {
    code: 'CORALITE-P401',
    title: 'Missing definePlugin wrapper',
    family: 'plugin',
    severity: 'error',
    fixable: true,
    fixActions: ['wrap_define_plugin'],
    summary: 'The plugin exports a bare object instead of calling definePlugin().',
    fix: 'Wrap the configuration in export default definePlugin({ ... }).'
  },
  {
    code: 'CORALITE-PAGE-101',
    title: 'Unknown custom element',
    family: 'page',
    severity: 'warning',
    fixable: false,
    summary: 'A page uses a custom element tag that no component defines.',
    fix: 'Register the component, fix the tag spelling, or remove the element.'
  },
  {
    code: 'CORALITE-PAGE-102',
    title: 'Missing required attribute',
    family: 'page',
    severity: 'error',
    fixable: true,
    fixActions: ['add_required_attribute'],
    summary: 'A page tag omits an attribute the component marks as required.',
    fix: 'Add the attribute with a valid value, or relax required in the component schema.'
  },
  {
    code: 'CORALITE-PAGE-201',
    title: 'Page reaches into component internals',
    family: 'page',
    severity: 'error',
    fixable: false,
    summary: 'A page script queries or mutates DOM inside a custom element instance.',
    fix: 'Communicate through attributes, events or context instead of internal nodes.'
  },
  {
    code: 'CORALITE-W204',
    title: 'Redundant ref existence guard',
    family: 'component',
    severity: 'warning',
    fixable: true,
    fixActions: ['unwrap_ref_guard'],
    summary: 'client() checks whether a template ref exists, but refs are guaranteed at mount.',
    fix: 'Use the ref directly and bind with { signal } for lifecycle cleanup.'
  },
  {
    code: 'CORALITE-W401',
    title: 'Unused declaration',
    family: 'component',
    severity: 'warning',
    fixable: false,
    summary: 'A getter, server state property or attribute declaration is never used.',
    fix: 'Remove the declaration or reference it from the template or a handler.'
  },
  {
    code: 'CORALITE-W402',
    title: 'Unused template ref',
    family: 'component',
    severity: 'warning',
    fixable: true,
    fixActions: ['remove_unused_ref'],
    summary: 'An element declares ref="name" but no handler reads it.',
    fix: 'Remove the ref, or add the coralite-ignore pragma while wiring it up in a later step.'
  },
  {
    code: 'CORALITE-W501',
    title: 'Reserved tag prefix',
    family: 'component',
    severity: 'warning',
    fixable: false,
    summary: 'A component tag uses a reserved prefix such as coralite-, c- or router-.',
    fix: 'Use a project prefix such as site-, ui- or app-.'
  },
  {
    code: 'CORALITE-W601',
    title: 'Defensive guard on framework context',
    family: 'component',
    severity: 'error',
    fixable: false,
    summary: 'Code guards a context key or global that the framework guarantees, hiding real errors.',
    fix: 'Remove the guard; if the value is missing the bug is in configuration or the build.'
  }
]
