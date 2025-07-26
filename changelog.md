# 🎁 Complete Release History

## Release: `v0.14.0`

### Changes from `v0.13.0` to `v0.14.0`

- 6abb375 (HEAD -> main, tag: v0.14.0) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 7af76fd refactor(plugin): use _plugins instead of options.plugins - ([Thomas David](https://codeberg.org/tjdavid))
- 187b3dd (origin/main) refactor(coralite): update options and source context references - ([Thomas David](https://codeberg.org/tjdavid))
- e8efcde fix(plugin): check if method is null before validating type - ([Thomas David](https://codeberg.org/tjdavid))
- a607a43 refactor: add conditional check for plugin method - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.14.0
Previous version ---- v0.13.0
Total commits ------- 5
```

## Release: `v0.13.0`

### Changes from `v0.12.0` to `v0.13.0`

- 8e2857e (tag: v0.13.0) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- ff4f4d0 refactor: update hook names to match onPageSet and onTemplateSet - ([Thomas David](https://codeberg.org/tjdavid))
- 068131e fix: include temp elements for hooks and remove it for compile - ([Thomas David](https://codeberg.org/tjdavid))
- fa76692 refactor: update plugin hooks - ([Thomas David](https://codeberg.org/tjdavid))
    BREAKING CHANGE: Plugin hooks now use onPageSet and onTemplateSet instead of onPageCreate and onTemplateCreate.

- 0183b90 types: update callback names for page and template events - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.13.0
Previous version ---- v0.12.0
Total commits ------- 5
```

## Release: `v0.12.0`

### Changes from `v0.11.4` to `v0.12.0`

- d7ac85d (tag: v0.12.0) Merge pull request 'Add plugin hook support' (#2) from hooks into main - ([Thomas David](https://codeberg.org/tjdavid))
    Reviewed-on: https://codeberg.org/tjdavid/coralite/pulls/2

- 2bc30cb (origin/hooks, hooks) docs: lowercase inline comments - ([Thomas David](https://codeberg.org/tjdavid))
- e103ed2 refactor: use pluginHooks[i] directly instead of callback variable - ([Thomas David](https://codeberg.org/tjdavid))
- bd7c93d fix: await trigger plugin hook in onPageUpdate - ([Thomas David](https://codeberg.org/tjdavid))
- 84ccf7f fix: include existing page data values on set - ([Thomas David](https://codeberg.org/tjdavid))
- 6501b5f fix: await updateItem in setItem method - ([Thomas David](https://codeberg.org/tjdavid))
- 48e8355 refactor: format export strings with newlines - ([Thomas David](https://codeberg.org/tjdavid))
- 129c976 refactor: use self instead of this in module linker - ([Thomas David](https://codeberg.org/tjdavid))
- ef312e2 refactor: add newline after export statement in plugin exports - ([Thomas David](https://codeberg.org/tjdavid))
- f8de684 refactor: update import order and fix path resolution - ([Thomas David](https://codeberg.org/tjdavid))
- 27e49b9 feat: add method to register plugin hooks - ([Thomas David](https://codeberg.org/tjdavid))
- 7fe6ad7 feat: add plugin hook trigger method - ([Thomas David](https://codeberg.org/tjdavid))
- 5abc9ce refactor: update module linker to use new source modules configuration - ([Thomas David](https://codeberg.org/tjdavid))
- 698feef refactor: update context and source context id in evaluate method - ([Thomas David](https://codeberg.org/tjdavid))
- 3d0bb65 refactor: add async to addRenderQueue method - ([Thomas David](https://codeberg.org/tjdavid))
- 0fc1e13 fix: use _options.path.pages instead of this.path.pages in warning message - ([Thomas David](https://codeberg.org/tjdavid))
- 618e763 refactor: use _options.path.templates instead of this.path.templates - ([Thomas David](https://codeberg.org/tjdavid))
- 186f2b0 types: add jsdoc to Coralite initalise method - ([Thomas David](https://codeberg.org/tjdavid))
- bc7962d refactor: fix pages path handling in compile method - ([Thomas David](https://codeberg.org/tjdavid))
- 75ac81f refactor: add async support for template and page file handlers - ([Thomas David](https://codeberg.org/tjdavid))
- 94b67b1 refactor: add plugin hook support to constructor - ([Thomas David](https://codeberg.org/tjdavid))
- 1c2705f refactor: initialise options with path and plugins - ([Thomas David](https://codeberg.org/tjdavid))
- 461c07e fix: check node version requirement - ([Thomas David](https://codeberg.org/tjdavid))
- 3443e67 refactor: update import to use coralite/plugins - ([Thomas David](https://codeberg.org/tjdavid))
- 7be5b07 types: add async callbacks for plugin events - ([Thomas David](https://codeberg.org/tjdavid))
- 14fb827 refactor: remove metadata and custom elements collection - ([Thomas David](https://codeberg.org/tjdavid))
- d5282d8 feat: add event handlers for page and template lifecycle events - ([Thomas David](https://codeberg.org/tjdavid))
- 8685865 refactor: return promise from getHtmlFiles function - ([Thomas David](https://codeberg.org/tjdavid))
- 734b5d4 feat: initialize coralite instance and compile documents - ([Thomas David](https://codeberg.org/tjdavid))
- d01cdb8 refactor: add async to setItem and deleteItem methods - ([Thomas David](https://codeberg.org/tjdavid))
- 35f33e3 build: use absolute path for coralite script - ([Thomas David](https://codeberg.org/tjdavid))
- 498d075 fix: only parse attribute tokens inside template tag - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.12.0
Previous version ---- v0.11.4
Total commits ------- 32
```

## Release: `v0.11.4`

### Changes from `v0.11.3` to `v0.11.4`

- 62e1511 (tag: v0.11.4) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 3454a17 refactor: handle non-array objects as arrays in text node replacement - ([Thomas David](https://codeberg.org/tjdavid))
- 7da3839 chore: update changelog - ([Thomas David](https://codeberg.org/tjdavid))
- 451f8c0 docs: update README image alt text and add video description - ([Thomas David](https://codeberg.org/tjdavid))
- e53142f fix: intro gif path - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.11.4
Previous version ---- v0.11.3
Total commits ------- 5
```

## Release: `v0.11.3`

### Changes from `v0.11.2` to `v0.11.3`

- fb96747 (tag: v0.11.3) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 2eee736 types: update type for excludeByAttribute property - ([Thomas David](https://codeberg.org/tjdavid))
- 4a37c35 docs: createPlugin detailed JSDoc descriptions - ([Thomas David](https://codeberg.org/tjdavid))
- 6de2fd6 docs: Update documentation links to use absolute URLs - ([Thomas David](https://codeberg.org/tjdavid))
- c38f9c4 build: use -S flag with node in shebang for experimental features - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.11.3
Previous version ---- v0.11.2
Total commits ------- 5
```

## Release: `v0.11.2`

### Changes from `v0.11.1` to `v0.11.2`

- b9d8c37 (tag: v0.11.2) chore: bump version - ([Thomas David](https://codeberg.org/tjdavid))
- e427d7d style: update comment formatting consistency - ([Thomas David](https://codeberg.org/tjdavid))
- 707c462 types: add ts-ignore for script.namespace.default - ([Thomas David](https://codeberg.org/tjdavid))
- 3e4df9a fix: correctly skip directive nodes in replaceToken function - ([Thomas David](https://codeberg.org/tjdavid))
- bed8aa6 docs: update parameter names and type annotations - ([Thomas David](https://codeberg.org/tjdavid))
- c065e9a fix: Improve error messages for template directory and module export issues - ([Thomas David](https://codeberg.org/tjdavid))
- a76bc28 feat: add save method to export processed documents as HTML files - ([Thomas David](https://codeberg.org/tjdavid))
- cc65461 refactor: use coralite.save instead of manual file operations - ([Thomas David](https://codeberg.org/tjdavid))
- 48f180f docs: add inline comments - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.11.2
Previous version ---- v0.11.1
Total commits ------- 9
```

## Release: `v0.11.1`

### Changes from `v0.11.0` to `v0.11.1`

- c0ab58b (tag: v0.11.1) docs: add experimental-import-meta-resolve flag to Node.js runtime options - ([Thomas David](https://codeberg.org/tjdavid))
- 5675297 chore: bump version - ([Thomas David](https://codeberg.org/tjdavid))
- 9ca30e8 build: update minimum required Node.js version - ([Thomas David](https://codeberg.org/tjdavid))
- 7b40a42 fix: script identifier path - ([Thomas David](https://codeberg.org/tjdavid))
- a9300f7 docs: update example commands in readme.md - ([Thomas David](https://codeberg.org/tjdavid))
- b128309 npmignore codeberg ci - ([Thomas David](https://codeberg.org/tjdavid))
- 398737d docs: use absolute path for logo - ([Thomas David](https://codeberg.org/tjdavid))
- 68eb2c7 docs: update readme image to logo.png - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.11.1
Previous version ---- v0.11.0
Total commits ------- 8
```

## Release: `v0.11.0`

### Changes from `v0.10.0` to `v0.11.0`

- 56f6474 (tag: v0.11.0) chore: bump version to 0.11.0 - ([Thomas David](https://codeberg.org/tjdavid))
- 29b2c6a chore: Remove unused test-unit script - ([Thomas David](https://codeberg.org/tjdavid))
- 38a7c85 test: add test for cast names from local JSON file - ([Thomas David](https://codeberg.org/tjdavid))
- 7605e09 docs: update ignoreByAttribute config format to use objects - ([Thomas David](https://codeberg.org/tjdavid))
- 8e13c2d types: update ignoreByAttribute to use object structure - ([Thomas David](https://codeberg.org/tjdavid))
    BREAKING CHANGE: The `ignoreByAttribute` parameter now expects an array of objects with `name` and `value` properties instead of arrays of string pairs. Update usage to pass `{ name: 'data-ignore', value: 'true' }` rather than `['data-ignore', 'true']`.

- e03b4e1 style: fix trailing comma in jsconfig.json moduleResolution - ([Thomas David](https://codeberg.org/tjdavid))
- a0c66cc refactor(fixtures): replace values with tokens and attributes in component definitions - ([Thomas David](https://codeberg.org/tjdavid))
- 5405757 refactor(define-component): rename options.values to options.tokens - ([Thomas David](https://codeberg.org/tjdavid))
    The parameter name in the defineComponent plugin's options object has been changed from `values` to `tokens` to more accurately reflect its purpose of representing computed tokens available in templates.
    
    BREAKING CHANGE: Users must update their code to use `options.tokens` instead of `options.values` when defining components.

- 7bcea1c feat: add support for import attributes - ([Thomas David](https://codeberg.org/tjdavid))
- 3b63339 fix: resolve template parent path using dirname instead of pathname - ([Thomas David](https://codeberg.org/tjdavid))
- ad7bc63 docs: add intro gif animation - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.11.0
Previous version ---- v0.10.0
Total commits ------- 11
```

## Release: `v0.10.0`

### Changes from `v0.9.0` to `v0.10.0`

- 0dcc16a (tag: v0.10.0) docs: updated types - ([Thomas David](https://codeberg.org/tjdavid))
- 9910719 fix: handle missing template paths by validating existence - ([Thomas David](https://codeberg.org/tjdavid))
- 4ea7747 types: add id property to value context type - ([Thomas David](https://codeberg.org/tjdavid))
- 95287ee refactor(lib/plugin.js): remove unused resolve import - ([Thomas David](https://codeberg.org/tjdavid))
- 5affa96 fix: use array slice to avoid mutating original pages list - ([Thomas David](https://codeberg.org/tjdavid))
- b0d0705 fix: resolve template identifier - ([Thomas David](https://codeberg.org/tjdavid))
- 7179b8e fix: extract onFileSet handler to handle unset updates - ([Thomas David](https://codeberg.org/tjdavid))
- a81f38e fix: ensure existing values are preserved when merging custom element attribs - ([Thomas David](https://codeberg.org/tjdavid))
- 0dd0caa fix: restrict documentValue.type assignment to 'page' or 'template' types - ([Thomas David](https://codeberg.org/tjdavid))
- 0426edb chore: update version and repository information - ([Thomas David](https://codeberg.org/tjdavid))
- 25696d5 types: add types configuration for plugins and types directory - ([Thomas David](https://codeberg.org/tjdavid))
- d83d39c types: add values to HTMLData and remove page/pageName from FilePath - ([Thomas David](https://codeberg.org/tjdavid))
- 6995a68 refactor: extract render logic into private method - ([Thomas David](https://codeberg.org/tjdavid))
- 67a869a refactor: improve clarity with method callback - ([Thomas David](https://codeberg.org/tjdavid))
- d2cd54c feat: add support for templates in plugins - ([Thomas David](https://codeberg.org/tjdavid))
- 9e90b59 refactor: remove unused page and pageName properties from path object - ([Thomas David](https://codeberg.org/tjdavid))
- 504a832 types: Update plugin instance type and add new imports - ([Thomas David](https://codeberg.org/tjdavid))
    Update the `plugins` parameter to use `CoralitePluginInstance[]` instead of `CoralitePlugin[]`.
    Add new imports for `CoraliteDocumentRoot` and `CoralitePluginInstance`.
    
    BREAKING CHANGE: Existing code using `CoralitePlugin[]` for the plugins parameter will need to be updated to use `CoralitePluginInstance[]`.

- e391ba3 fix: correct document.path reference in component definition - ([Thomas David](https://codeberg.org/tjdavid))
- 5451650 refactor(utils): add generic type parameter to cleanKeys function - ([Thomas David](https://codeberg.org/tjdavid))
- 6f37539 fix(coralite): improve handling of custom elements on file updates - ([Thomas David](https://codeberg.org/tjdavid))
    Update logic for tracking custom elements during file updates to ensure:
    - Proper addition of new elements
    - Accurate removal of outdated references
    - Avoid duplicate entries in pageCustomElements

- ee8bc43 refactor: update Coralite onFileSet handler to use data parameter and add metadata fields - ([Thomas David](https://codeberg.org/tjdavid))
- 032b934 feat: add metadata extraction to parseHTML - ([Thomas David](https://codeberg.org/tjdavid))
    Extracts metadata from HTML into a new 'meta' field in the return value.
    Removed the separate parseHTMLMeta function.
    
    BREAKING CHANGE: The parseHTMLMeta function has been removed. Use the 'meta'
    property in the parseHTML return value instead.

- 3531662 feat(core): Introduce context ID for scoped component value management - ([Thomas David](https://codeberg.org/tjdavid))
    Add context management to isolate component and slot values, preventing conflicts
    and improving modularity. Context IDs are generated based on path, element name,
    and position to ensure unique scoping for each instance.
    
    BREAKING CHANGE: Component value handling has been refactored to use context-aware
    scoping. Existing value overrides may need adjustment when using nested components.

- aa61971 fix(import-meta): use process.cwd() for import.meta.url initialization - ([Thomas David](https://codeberg.org/tjdavid))
    Replace calculated directory path with process.cwd() to ensure consistent
    absolute path resolution for module imports.

- 470c799 docs: remove aggregation and collection types from reference - ([Thomas David](https://codeberg.org/tjdavid))
- d2b26cf docs: update cli path examples to use relative paths without leading './' - ([Thomas David](https://codeberg.org/tjdavid))
- 1cb3fd7 fix: use recursive directory creation in output path handling - ([Thomas David](https://codeberg.org/tjdavid))
- ac5d34c fix: prevent TypeError when template is undefined - ([Thomas David](https://codeberg.org/tjdavid))
- 52e6def chore: add script to generate changelog from git history - ([Thomas David](https://codeberg.org/tjdavid))
- 865611d chore: add 'scripts' directory to .npmignore - ([Thomas David](https://codeberg.org/tjdavid))
- 1c02905 chore: update repository and bug tracker URLs in package.json - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.10.0
Previous version ---- v0.9.0
Total commits ------- 31
```

## Release: `v0.9.0`

### Changes from `v0.8.1` to `v0.9.0`

- 8999339 (tag: v0.9.0) docs: Update Coralite initialization syntax and parameter documentation - ([Thomas David](https://codeberg.org/tjdavid))
- e24e7d1 refactor: Update defineComponent import/export to use #plugins alias - ([Thomas David](https://codeberg.org/tjdavid))
- 44509b6 chore: remove aggregation plugin file - ([Thomas David](https://codeberg.org/tjdavid))
    The file plugins/aggregation.js has been deleted as it is no longer part of core.

- e7b108d fix(utils): use result object instead of mutating original - ([Thomas David](https://codeberg.org/tjdavid))
- 9d077d0 fix(collection): updateItem synchronizes result property - ([Thomas David](https://codeberg.org/tjdavid))
- e9a243a fix: move _onUpdate callback to ensure execution only when document exists - ([Thomas David](https://codeberg.org/tjdavid))
- 3458e4e fix: only merge element attribs when head is set - ([Thomas David](https://codeberg.org/tjdavid))
- 9e05433 docs: update type reference page - ([Thomas David](https://codeberg.org/tjdavid))
- 812e3a7 docs: simplify CLI command example by removing unnecessary node flag - ([Thomas David](https://codeberg.org/tjdavid))
- d70d77a docs: Update documentation link and Node.js flags - ([Thomas David](https://codeberg.org/tjdavid))
    - Changed full documentation link to Codeberg's main branch URL
    - Added --experimental-import-meta-resolve flag to Node.js requirements

- d5bf40d docs: enhance Coralite constructor documentation with plugin usage example - ([Thomas David](https://codeberg.org/tjdavid))
    Update JSDoc for Coralite constructor to include:
    - Direct type reference for plugins parameter (CoralitePlugin[])
    - Example demonstrating plugin and ignoreByAttribute usage
    - Added import declaration for CoralitePlugin in comments

- 8773690 fix(cleanKeys): return new object with camelCase keys - ([Thomas David](https://codeberg.org/tjdavid))
- 8e6eeaf docs: remove @private tags from JSDoc comments - ([Thomas David](https://codeberg.org/tjdavid))
    The _evaluate and _moduleLinker methods are no longer marked as private in documentation. This is only until ts can handle @memberOf

- 4bc21df chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- d61629d fix: Add validation for absolute parent path in template evaluation - ([Thomas David](https://codeberg.org/tjdavid))
    Ensure resolved parent paths are absolute to prevent issues with relative
    path handling. Throws an error if the path is not absolute, improving
    debuggability for misconfigured template paths.

- 571531d fix(aggregation): add type parameter to getHtmlFiles for accurate document filtering - ([Thomas David](https://codeberg.org/tjdavid))
    Adds the `type: 'page'` option when retrieving HTML files to ensure only page
    documents are aggregated. Updates variable name from `documents` to `collection`
    and refines the error message for clarity.

- 9a573fa refactor: remove unused CoraliteDocument and CoraliteModule imports from define-component.js - ([Thomas David](https://codeberg.org/tjdavid))
- 6f1f1f2 refactor: remove parseHTMLDocument function - ([Thomas David](https://codeberg.org/tjdavid))
    The `parseHTMLDocument` function has been removed as it was no longer needed; its functionality is now handled by the more general `parseHTML` function. This simplifies the codebase and reduces redundancy.
    
    BREAKING CHANGE: Users relying on `parseHTMLDocument` will need to use `parseHTML` directly for similar functionality.

- 1cf47c9 feat: add document type option to getHtmlFiles - ([Thomas David](https://codeberg.org/tjdavid))
    Allow specifying 'page' or 'template' as document type when retrieving HTML files. Adds 'type' parameter to function options and stores it in each item's metadata.

- 10f83fe feat: Add support for setting document type from hook result - ([Thomas David](https://codeberg.org/tjdavid))
- 5606870 types: add 'type' field to HTMLData and event result types - ([Thomas David](https://codeberg.org/tjdavid))
    Add a 'type' property ('page' | 'template') to distinguish between main pages and reusable templates in HTMLData. Update CoraliteCollectionCallbackResult and CoraliteCollectionEventResult to include optional 'type' for document categorization. Improve JSDoc descriptions for path-related properties in CoraliteFilePath.
    
    BREAKING CHANGE: Existing code expecting HTMLData without a 'type' field may need adjustments to handle the new optional property.

- 2f08966 refactor: remove unused documents array declaration - ([Thomas David](https://codeberg.org/tjdavid))
- 69becec docs: add @private JSDoc tags to Coralite methods - ([Thomas David](https://codeberg.org/tjdavid))
    Update JSDoc comments for `createComponent` and `_moduleLinker` methods
    with @private tag to indicate internal implementation details.

- 4b30dcf docs: Update JSDoc for compile method to clarify parameters and return value - ([Thomas David](https://codeberg.org/tjdavid))
- ff244cf docs: Add JSDoc types for pageCustomElements and childCustomElements - ([Thomas David](https://codeberg.org/tjdavid))
- f8c2edf feat(lib/coralite.js): Add method to retrieve page paths using custom element template - ([Thomas David](https://codeberg.org/tjdavid))
    This commit introduces a new method in the Coralite class that allows retrieving an array of page paths associated with a given custom element template.

- 243eade fix: use structured clone for render results to prevent unintended mutations - ([Thomas David](https://codeberg.org/tjdavid))
    Use `structuredClone` when extracting document results to ensure immutability.
    This prevents potential side effects from modifying original objects later in
    the rendering process.

- 9cc36bb types: Rename CoraliteDocumentCollectionItem to CoraliteCollectionItem - ([Thomas David](https://codeberg.org/tjdavid))
- 3406e6b feat: add type field to templates and pages configuration - ([Thomas David](https://codeberg.org/tjdavid))
    Add 'type' property to distinguish between template and page files in the configuration objects.

- fca20e0 fix: trim pages prefix from path when compiling - ([Thomas David](https://codeberg.org/tjdavid))
    When processing paths during compilation, trim the 'pages' directory prefix if present to ensure accurate lookups in getListByPath.

- 1115fc8 fix(components): Fix component path resolution in createComponent and _evaluate - ([Thomas David](https://codeberg.org/tjdavid))
- 05c4a75 refactor(coralite): remove path duplication in Coralite constructor - ([Thomas David](https://codeberg.org/tjdavid))
- 7a0c67a feat: track custom element usage across pages dynamically - ([Thomas David](https://codeberg.org/tjdavid))
    Introduce mechanisms to monitor and update references between custom elements and pages when files are added, modified, or deleted. This enables efficient management of page-element relationships through onFileSet, onFileUpdate, and onFileDelete handlers.
    
    - Tracks which pages use each custom element
    - Maintains child element hierarchy mappings
    - Updates references automatically on file changes

- a3ecc7f refactor: update file handling callbacks in Coralite - ([Thomas David](https://codeberg.org/tjdavid))
    Renamed onFileLoaded to onFileSet and added onFileUpdate to handle
    file updates separately.

- 69f3cbb docs: remove @template T from getHTML function - ([Thomas David](https://codeberg.org/tjdavid))
- 07cd45c refactor: update parameter name from 'filename' to 'pathname' in getHtmlFile - ([Thomas David](https://codeberg.org/tjdavid))
- 29bfd15 refactor(html): update to use CoraliteCollection with event-based file handling - ([Thomas David](https://codeberg.org/tjdavid))
    Replace Documents class with CoraliteCollection and introduce event-driven callbacks
    (onFileSet, onFileUpdate, onFileDelete) for managing HTML files. This changes the API
    signature of getHtmlFiles(), removing the deprecated onFileLoaded parameter.
    
    BREAKING CHANGE: The `onFileLoaded` callback has been removed in favor of
    event-based handlers (`onFileSet`, `onFileUpdate`, `onFileDelete`). Existing
    implementations using `onFileLoaded` will need to be updated.

- 1a11ba4 refactor(collection): restructure setItem to use updateItem for existing items - ([Thomas David](https://codeberg.org/tjdavid))
    - Move pre-set hook and collection update logic into updateItem method
    - Simplify setItem by delegating updates to updateItem
    - Update _onUpdate to assign result directly to value.result
    - Remove redundant checks and streamline item initialization flow

- 437e73e refactor: rename documents variable to collection for clarity - ([Thomas David](https://codeberg.org/tjdavid))
- 1e491dd fix(plugins/define-component): correct computedValue access in HTML parsing - ([Thomas David](https://codeberg.org/tjdavid))
    Fix incorrect index access on computedValue when calling parseHTML. Previously,
    computedValue[i] would process individual characters instead of the full string,
    leading to unexpected behavior.

- ec5e429 refactor: Remove unused 'values' parameter from replaceCustomElementWithTemplate - ([Thomas David](https://codeberg.org/tjdavid))
    The 'values' parameter was removed from the function signature and call-sites since it was never used.

- a421f4f refactor(types): rename document-related types to collection-based equivalents - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor type definitions and callback interfaces to use 'collection' terminology instead of 'document' to align with updated data handling patterns.
    
    - Renamed CoraliteDocumentCallbackResult → CoraliteCollectionCallbackResult
    - Updated CoraliteDocumentSetCallback → CoraliteCollectionEventSet
    - Introduced new event handlers for collection operations (delete, update)

- 2fa3841 refactor: Rename CoraliteDocuments to CoraliteCollection and add event-based API - ([Thomas David](https://codeberg.org/tjdavid))
    Rename the class from CoraliteDocuments to CoraliteCollection and update its interface
    to use an options object with onSet, onUpdate, and onDelete event handlers instead of
    a callback function. This change introduces a more flexible event-driven architecture.
    
    BREAKING CHANGE: The constructor now accepts an options object with event callbacks
    instead of a single callback function. Existing code using the old callback API will need
    to be updated to use the new event-based system.

- bd0174a refactor: update replaceCustomElementWithTemplate to use component instance directly - ([Thomas David](https://codeberg.org/tjdavid))
- a0280b6 Merge pull request 'plugin-system' (#1) from plugin-system into main - ([Thomas David](https://codeberg.org/tjdavid))
    Reviewed-on: https://codeberg.org/tjdavid/coralite/pulls/1

- b80c1ba (origin/plugin-system, plugin-system) fix: correct usage of aggregation function in posts component - ([Thomas David](https://codeberg.org/tjdavid))
    Update import statement and method call from `aggregate` to `aggregation` as
    the correct function name is exported from coralite.

- c7b661c refactor: rename tokens to values in component definitions - ([Thomas David](https://codeberg.org/tjdavid))
    Updated test fixture components to use `values` instead of `tokens` for consistency and preparation for future API changes.

- af06f9c feat: add plugins support via imports and exports configuration - ([Thomas David](https://codeberg.org/tjdavid))
- fe00f1e docs: rename typedef.md to types.md - ([Thomas David](https://codeberg.org/tjdavid))
- 1c8a315 types: add CoraliteDocumentSetCallback and related types - ([Thomas David](https://codeberg.org/tjdavid))
    Add new TypeScript definitions for CoraliteDocumentSetCallbackResult,
    CoraliteDocumentCollectionItem, and CoraliteDocumentCallbackResult
    to support callback handling in document processing workflows.

- 9b6da6f types: Remove CoraliteComponent typedef - ([Thomas David](https://codeberg.org/tjdavid))
    The CoraliteComponent type definition was removed from the types/index.js file
    as it is no longer required by the codebase.
    
    BREAKING CHANGE: Any code relying on the CoraliteComponent typedef may need
    updates to remove references to this type.

- c8f9421 types: Rename CoraliteDocumentTokens to CoraliteDocumentValues - ([Thomas David](https://codeberg.org/tjdavid))
    Update property name and typedef to better reflect the purpose of
    storing metadata/variable information rather than raw tokens.
    
    BREAKING CHANGE: Any references to CoraliteDocumentTokens or
    the 'tokens' property in module definitions must be updated to
    CoraliteDocumentValues and 'values' respectively.

- fca9de9 feat: Integrate config-based plugins using Coralite class API - ([Thomas David](https://codeberg.org/tjdavid))
    Update coralite.js to use the Coralite class constructor and compile method,
    loading configuration from disk to enable plugin integration. This change
    restructures how templates and plugins are initialized, allowing dynamic
    configuration through loaded settings.
    
    BREAKING CHANGE: The `coralite()` function call has been replaced with
    `new Coralite(...).compile()`, requiring updates to any direct usage of
    the coralite function interface.

- 7b51352 feat: add export for aggregation plugin - ([Thomas David](https://codeberg.org/tjdavid))
- 2a29bdc refactor: rename coralite import and adjust export paths - ([Thomas David](https://codeberg.org/tjdavid))
    Update import statement to use PascalCase 'Coralite' and modify export paths to include new modules while removing deprecated ones.

- 6b1df93 refactor: remove unused imports and dependencies from parse.js - ([Thomas David](https://codeberg.org/tjdavid))
    Simplify the file by eliminating redundant import statements and type references that are no longer required. This reduces complexity and improves maintainability without altering functionality.
    
    - Removed imports from 'html-module.js', 'node:vm', 'type-helper.js', 'node:path', and 'utils.js'
    - Updated JSDoc type references to remove obsolete types

- 350e28b refactor: remove legacy component parsing and token replacement logic - ([Thomas David](https://codeberg.org/tjdavid))
    BREAKING CHANGE: Moved module logic to Coralite prototypes. `createComponent`, `parseScript`, `moduleLinker`, `replaceToken`, and `replaceCustomElementWithTemplate` functions which were used for handling Coralite module parsing, token replacement, and custom element rendering.
    
    The `getTokensFromString` function has been simplified and moved to a more concise implementation.

- 9e2f276 refactor(parse): rename documentTokens to documentValues for clarity - ([Thomas David](https://codeberg.org/tjdavid))
    Rename variable from `documentTokens` to `documentValues` to better reflect its purpose of storing parsed attribute and text node values rather than raw token data.

- 7114c8f refactor: move getPkg function and PackageJson typedef to utils.js - ([Thomas David](https://codeberg.org/tjdavid))
- b3601cc feat: Add define-component plugin for processing component values and slots - ([Thomas David](https://codeberg.org/tjdavid))
    Introduce a new plugin to handle dynamic component value computation,
    slot content processing, and custom element template replacement within
    the Coralite framework. The plugin supports both synchronous and
    asynchronous value resolution and manages document structure updates.
    
    This implementation enables modular component definitions with support
    for computed properties, slot content transformation, and seamless
    integration of custom elements through template expansion.

- 7fee5f3 feat(coralite.config.js): add aggregation plugin to Coralite config - ([Thomas David](https://codeberg.org/tjdavid))
- 744d9ea feat: add isCoralitePageItem type check function - ([Thomas David](https://codeberg.org/tjdavid))
    Add a helper function to determine if an object is a CoralitePageItem by checking for the presence of 'path' and string content properties.

- d666a83 refactor(html): move to synchronous file handling and introduce Documents class - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor HTML file loading logic to use synchronous methods (readdirSync, readFileSync)
    and replace get-html.js with html.js. The new implementation returns a Documents
    instance instead of an array of HTMLData objects.
    
    BREAKING CHANGE: getHtmlFiles now returns a Documents instance instead of Promise<HTMLData[]>
    and accepts an optional onFileLoaded callback.

- 4383298 feat: Add aggregation plugin for HTML content aggregation - ([Thomas David](https://codeberg.org/tjdavid))
    Introduce a plugin that aggregates HTML content from specified paths into
    a collection of components. Supports filtering, sorting, pagination, and
    dynamic rendering of aggregated documents.
    
    Implements methods to:
    - Retrieve and process HTML files from directories
    - Apply custom filters and sort functions
    - Handle pagination with dynamic template rendering
    - Generate structured content nodes for output

- ea073ae feat: create plugin helper - ([Thomas David](https://codeberg.org/tjdavid))
    Introduce types and function to create plugins with validation for Coralite modules.
    Implement context interface, plugin module callback, and factory function that ensures
    plugin method is a function before returning the plugin structure.

- 203e7ae feat: Add config loader for coralite.config.js - ([Thomas David](https://codeberg.org/tjdavid))
    This commit introduces a function to load configuration from coralite.config.js in the current working directory. The function checks if the file exists, imports it asynchronously, and returns its default export. If the file isn't found or fails to load, it returns null or throws an error respectively.

- 3a62f69 refactor: Replace document rendering with component-based creation and token replacement - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor core rendering logic to use a component-based approach with dynamic value substitution and slot handling. Introduce `createComponent` for modular processing, `_evaluate` for script execution, and `replaceToken` for attribute/text node replacements.
    BREAKING CHANGE: The `renderDocument` function has been removed and replaced with `createComponent`. Existing code using the old method must be updated to use the new API.

- 9cf0abc feat: add addRenderQueue method to Coralite prototype - ([Thomas David](https://codeberg.org/tjdavid))
    Add a method to enqueue pages for rendering. Accepts either a page path string or CoraliteDocumentCollectionItem, validates existence, and adds to internal render queue.

- 5ac7cae fea: add compile method for rendering documents with component processing - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor the compile method to handle document rendering with dynamic path resolution and custom element processing. The new implementation supports compiling pages by path, processes components asynchronously, and returns results with render durations.

- 3954b96 feat: add CoraliteDocuments class for managing document collections - ([Thomas David](https://codeberg.org/tjdavid))
    This commit introduces a new class, CoraliteDocuments, which provides methods to organize, retrieve, and modify HTMLData objects. The class maintains collections grouped by file path and unique identifiers, supporting operations such as adding, updating, and removing documents.

- c3f8d07 refactor: Refactor Coralite to use class-based structure with plugin system - ([Thomas David](https://codeberg.org/tjdavid))
    Convert coralite function to class constructor with plugin support
    Remove placeholder exports for tokens/component definitions
    Integrate plugin system via constructor options
    Add source module context management
    
    BREAKING CHANGE: The coralite function is now a constructor that must be instantiated. Existing function-based usage will need to be updated to use the class API.

- fa9101c docs: Add descriptive comments to type definitions - ([Thomas David](https://codeberg.org/tjdavid))
- 467c1a5 docs: update coralite documentation with project structure and usage examples - ([Thomas David](https://codeberg.org/tjdavid))
    Update the Coralite documentation to include detailed examples of typical project structures,
    template and page file formats, ignored element handling, recursive template support,
    and a complete usage example. The new content provides clearer guidance for developers
    setting up and using the Coralite library.
    
    - Add structured project layout examples
    - Include template and page file code samples
    - Document ignoreByAttribute usage pattern
    - Explain recursive template directory processing
    - Provide full JavaScript usage example

- fc70052 docs: add comprehensive type definitions reference - ([Thomas David](https://codeberg.org/tjdavid))
    Add a detailed type reference document for Coralite framework types,
    including structures for HTML parsing, rendering, modules, and aggregation.
    The document includes tables, property descriptions, and internal links
    for easy navigation across core type definitions.

- eca5a3e feat: replace computed token custom element tags with template content - ([Thomas David](https://codeberg.org/tjdavid))
- 4a20333 feat: Add replaceCustomElementWithTemplate function - ([Thomas David](https://codeberg.org/tjdavid))
    This change introduces a new function that replaces custom elements with their template content by creating component instances and updating the document structure accordingly.

- 239e77b docs: add return type annotation to parseHTML function - ([Thomas David](https://codeberg.org/tjdavid))
- 6046562 feat: add page path metadata to values in aggregate function - ([Thomas David](https://codeberg.org/tjdavid))
    Enhance context available for rendering by including $pathname, $filename, and $dirname from current page's path metadata.

- 4a1aef3 fix(parse): update  computed tokens promise check for thenable objects - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.9.0
Previous version ---- v0.8.1
Total commits ------- 79
```

## Release: `v0.8.1`

### Changes from `v0.8.0` to `v0.8.1`

- 5d1b926 (tag: v0.8.1) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- d25721b ci: fix linux symlink - ([Thomas David](https://codeberg.org/tjdavid))
- 934e063 ci: add coralite globally - ([Thomas David](https://codeberg.org/tjdavid))
- c46cf59 ci: add params to symlink - ([Thomas David](https://codeberg.org/tjdavid))
- a074fba ci: add symlink step to CI workflows - ([Thomas David](https://codeberg.org/tjdavid))
    This commit adds a new step in all relevant CI workflows to execute `pnpm link`, ensuring proper package linking during build and test processes.

- 8351b36 fix(parser): add check for slot attribute before assigning to named slot - ([Thomas David](https://codeberg.org/tjdavid))
    Prevent potential errors by verifying the presence of `slot` attribute
    before attempting to assign it to a named slot element.

- 4c939b7 refactor: remove getSubDirectory function - ([Thomas David](https://codeberg.org/tjdavid))
- e2a82e0 refactor: use document.path properties for directory handling - ([Thomas David](https://codeberg.org/tjdavid))
- b6ca133 refactor: Update template variables to use $prefix notation - ([Thomas David](https://codeberg.org/tjdavid))
- 263e6a5 chore: update bin path - ([Thomas David](https://codeberg.org/tjdavid))
- b412225 chore: add bugs URL - ([Thomas David](https://codeberg.org/tjdavid))
- 2dc40c5 chore: update changelog - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.8.1
Previous version ---- v0.8.0
Total commits ------- 12
```

## Release: `v0.8.0`

### Changes from `v0.7.0` to `v0.8.0`

- 25c4669 (tag: v0.8.0) feat(aggregate): add pagination support - ([Thomas David](https://codeberg.org/tjdavid))
    Implement pagination processing logic including document handling,
    template rendering, and dynamic attribute generation based on
    pagination configuration. Replace previous sort function handling
    with new pagination system.

- 1268e3c fix(aggregate): handle non-array metadata values correctly - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor metadata aggregation logic to use `Array.isArray()` check instead of
    relying on length > 1. Removed redundant filtering logic that was no longer used.

- 42c3ae0 fix(aggregate): handle string and non-array limit values correctly - ([Thomas David](https://codeberg.org/tjdavid))
    Ensure `options.limit` is treated as a number and not an array to prevent incorrect
    page limit calculations. This addresses potential issues when `options.limit`
    is provided as a string or non-array value, ensuring consistent behavior.
    
    - Convert string-based limits to integers using parseInt.
    - Add type check for Array.isArray to avoid unintended array handling.

- 0538a80 fix(aggregate): Handle offset parsing robustly for numeric conversion - ([Thomas David](https://codeberg.org/tjdavid))
    Ensure `options.offset` is parsed as an integer when provided as a string,
    and handle cases where `offset` might be undefined or non-numeric. This
    improves reliability in startIndex calculation by avoiding potential type-related
    issues during pagination.
    
    Fixes edge case where offset was not properly converted from string to number.

- 4d2fe56 feat(aggregate): Add metadata-based page filtering using options.filter - ([Thomas David](https://codeberg.org/tjdavid))
    Allow filtering pages by checking metadata against the provided function in options.filter. Processes each page's metadata and applies the filter to determine inclusion.

- 176c7f3 feat(lib/html-module): add support for custom sort function in aggregate - ([Thomas David](https://codeberg.org/tjdavid))
- 3acfb99 feat(lib/html-module): add pagination support with token validation - ([Thomas David](https://codeberg.org/tjdavid))
- 41b0e10 refactor(lib): integrate htmlparser2 and dom-serializer for improved HTML parsing - ([Thomas David](https://codeberg.org/tjdavid))
- 0c7fb5e refactor(html-module): update aggregate to use component element children and return Aggregation object - ([Thomas David](https://codeberg.org/tjdavid))
- 6bb83d3 refactor: restructure document rendering logic and add HTMLData type support - ([Thomas David](https://codeberg.org/tjdavid))
    Rename coraliteModules to components for clarity, introduce renderDocument function,
    and update imports to include new types (IgnoreByAttribute, HTMLData).

- 8d4b43c refactor: move coralite rendering logic to new renderDocument function - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor the main rendering logic into a modular `renderDocument` function with improved parameters for handling recursive rendering of head sections and accumulating results.

- c81786e types: add pagination configuration to CoraliteAggregate - ([Thomas David](https://codeberg.org/tjdavid))
- c8ddec4 feat(metadata): Update metadata token prefix to '$' - ([Thomas David](https://codeberg.org/tjdavid))
    BREAKING CHANGE: This change is a breaking change for existing configurations relying on the previous `'meta_'` prefix. All references to metadata tokens must be updated to use the new `$` prefix to maintain compatibility with this version.

- ee57e18 feat: add parsePagination function for handling pagination templates - ([Thomas David](https://codeberg.org/tjdavid))
    Implement a function to parse HTML content into a structured document, allowing customization of pagination elements through template and attribute configurations.

- 4471482 types: add Aggregation typedef and update imports - ([Thomas David](https://codeberg.org/tjdavid))
    Introduce a new Aggregation type definition with nodes and documents properties, and update import statements to include additional types from '#types'.

- 2772969 docs: Improve JSDoc clarity for parseHTMLDocument function - ([Thomas David](https://codeberg.org/tjdavid))
- 37e79db refactor: restructure html file path properties - ([Thomas David](https://codeberg.org/tjdavid))
    Restructure the object pushed into the html array to use a nested
    path object with detailed properties for better clarity and consistency.

- dab3a61 refactor: Export createTextNode function - ([Thomas David](https://codeberg.org/tjdavid))
- c538186 fix: handle custom element creation with proper tag validation - ([Thomas David](https://codeberg.org/tjdavid))
    The condition for checking valid HTML tags now respects the presence of `customElements`,
    allowing custom tags to bypass standard validation without error. This prevents incorrect
    rejection of valid custom elements while maintaining safety checks for standard tags.
    
    - Previously, all elements were checked against `validTags`, which incorrectly rejected
      custom elements even when `customElements` was provided.
    - Now, the check is skipped if `customElements` is present, ensuring proper handling of
      both standard and custom element creation.

- 58d101d refactor: update addMetadata to support non-array values as array of objects - ([Thomas David](https://codeberg.org/tjdavid))
    Update the `addMetadata` function to handle cases where the existing value is not an array. Non-array values are now wrapped in an array of objects containing `{ name, content }`. This change allows multiple entries (e.g., Open Graph metadata) under the same key while preserving backward compatibility with single-value entries.

- d0fa67c docs: update parseHTMLMeta parameters and example documentation - ([Thomas David](https://codeberg.org/tjdavid))
    Update the JSDoc for the `parseHTMLMeta` function to clarify the purpose of the `options.ignoreByAttribute` parameter, remove outdated reference to `options.html`, and adjust the usage example to include the new option.

- de8035e fix: correct path calculation in parseScript function - ([Thomas David](https://codeberg.org/tjdavid))
- b9c94ee refactor(parse): use scriptResult.values instead of computedValues when merging values - ([Thomas David](https://codeberg.org/tjdavid))
    Update the code to use the new structure from `parseScript`, which separates documents and values into distinct properties.

- 7b0be0c fix: correct script parsing path resolution and module identifier - ([Thomas David](https://codeberg.org/tjdavid))
    Use `component.path.page` for resolving parent paths and `component.path.pathname`
    as the module identifier to ensure accurate URL resolution and source context.
    
    Previously used `component.parentPath` which may have led to incorrect path calculations.

- 803aa3e refactor(parse): refactor aggregate method to use helper and collect documents - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor the aggregate method to utilize a helper function for aggregation,
    collect documents into an array, and return structured data with values
    and documents.

- 2c77b44 fix: add warning when component is not found - ([Thomas David](https://codeberg.org/tjdavid))
    Improve debugging by adding a console warning when a referenced component
    is missing from the components registry, preventing silent failures in
    document rendering.

- 885fd6c refactor(parseModule): remove html parameter and introduce lineOffset property - ([Thomas David](https://codeberg.org/tjdavid))
    BREAKING CHANGE: The 'html' option has been removed from parseModule's parameters. Consumers relying on this should update their code accordingly.

- 84c8a74 types: allow string or CoraliteToken[] as meta value types - ([Thomas David](https://codeberg.org/tjdavid))
    Update `parseHTMLMeta` to accept both string and CoraliteToken[] values for metadata entries instead of only arrays.
    
    BREAKING CHANGE: Consumers relying on strict array return type may need adjustments if string values are now present.

- 0b9ce81 refactor: merge html.path into path object in parseHTMLDocument - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor the way the `path` property is assigned in `parseHTMLDocument`
    to combine the existing `path` with `html.path` using Object.assign.
    
    This change simplifies how path information is handled by consolidating
    properties into a single merged object.

- 1964a60 types: update JSDoc types for aggregate callbacks - ([Thomas David](https://codeberg.org/tjdavid))
    Change metadata parameter type from Object.<string, string> to CoraliteToken
    and update sort parameters to accept CoraliteToken arrays.

- 2205c1a types: Refactor types to introduce CoraliteFilePath and improve module interface definitions - ([Thomas David](https://codeberg.org/tjdavid))
    Update HTMLData and CoraliteModule interfaces to use CoraliteFilePath, add new properties for better structure, and enhance documentation. Modify CoraliteDocument's path to combine CoralitePath with CoraliteFilePath.

- c37fa7c docs: add CoraliteComponent import - ([Thomas David](https://codeberg.org/tjdavid))
- 281e07e refactor: rename getHTML to getHtmlFiles and add getHtmlFile function - ([Thomas David](https://codeberg.org/tjdavid))
    Rename the `getHTML` function to `getHtmlFiles`. Add a new `getHtmlFile` function to read individual HTML files, enabling more granular file handling in modules like `coralite.js` and `html-module.js`.

- f91251a types: Update return type of createComponent to CoraliteComponent - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor the `createComponent` function to return a `CoraliteComponent` object instead of a raw `CoraliteElement`. This aligns with new type definitions introduced in `types/index.js`, which explicitly define `CoraliteComponent` as an object containing both `element` and optional `documents`.
    
    BREAKING CHANGE: Consumers expecting a `CoraliteElement` directly from `createComponent` will need to access the `element` property on the returned `CoraliteComponent`.

- d6fab1e refactor: use cleanKeys for consistent naming conventions - ([Thomas David](https://codeberg.org/tjdavid))
    Use cleanKeys to convert object keys to camel case format when processing
    component values and custom attributes. Introduces 'head' parameter to control
    cleaning behavior during recursion.
    
    BREAKING CHANGE: All templates using kebab-case tokens (e.g., `my-token`) must now use camelCase equivalents (e.g., `myToken`). Existing templates with kebab-case will no longer work as expected and require migration.

- dfe3b06 docs: update aggregate comments - ([Thomas David](https://codeberg.org/tjdavid))
- 6a495f3 feat: add document data to  component - ([Thomas David](https://codeberg.org/tjdavid))
- 17afeb4 feat: require experimental-import-meta-resolve for dynamic imports - ([Thomas David](https://codeberg.org/tjdavid))
- 34ccd76 feat: dynamic module linker - ([Thomas David](https://codeberg.org/tjdavid))
- 828bcaa feat: add console to script context - ([Thomas David](https://codeberg.org/tjdavid))
- 47ab7db chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 4c7f361 fix kleur dependencies - ([Thomas David](https://codeberg.org/tjdavid))
- 2f88f2d chore: update changelong - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.8.0
Previous version ---- v0.7.0
Total commits ------- 43
```

## Release: `v0.7.0`

### Changes from `v0.6.9` to `v0.7.0`

- d7b183d (tag: v0.7.0) fix: use type helper to confirm child is a node - ([Thomas David](https://codeberg.org/tjdavid))
- b574569 feat: check if slot is a node - ([Thomas David](https://codeberg.org/tjdavid))
- de05e38 feat: type helper functions - ([Thomas David](https://codeberg.org/tjdavid))
- 24f3935 test: cover nested components attributes - ([Thomas David](https://codeberg.org/tjdavid))
- 8dc8f5d fix: apply nested custom component attribute values - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.7.0
Previous version ---- v0.6.9
Total commits ------- 5
```

## Release: `v0.6.9`

### Changes from `v0.6.8` to `v0.6.9`

- e79d7c9 (tag: v0.6.9) fix: aggregation limit is offset by offset - ([Thomas David](https://codeberg.org/tjdavid))
- 6f8253f test: cover nested document root components - ([Thomas David](https://codeberg.org/tjdavid))
- 77d0e36 feat: create nested custom elements on  document root - ([Thomas David](https://codeberg.org/tjdavid))
- 2c176e5 chore: update changelog - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.9
Previous version ---- v0.6.8
Total commits ------- 4
```

## Release: `v0.6.8`

### Changes from `v0.6.7` to `v0.6.8`

- 3b8fe8c (tag: v0.6.8) test: use parseHTML - ([Thomas David](https://codeberg.org/tjdavid))
- f7d6ab9 test: add meta prefix to tokens - ([Thomas David](https://codeberg.org/tjdavid))
- 34c15d2 test: remove unused variables - ([Thomas David](https://codeberg.org/tjdavid))
- b39ac47 test: cover nested components - ([Thomas David](https://codeberg.org/tjdavid))
- 81c3da4 feat: computed slots parse strings - ([Thomas David](https://codeberg.org/tjdavid))
- 585b7d6 fix: remove slot attribute - ([Thomas David](https://codeberg.org/tjdavid))
- 00f68ef fix: process computed tokens before replacing values - ([Thomas David](https://codeberg.org/tjdavid))
- b13a016 feat: add identifier to SourceTextModule - ([Thomas David](https://codeberg.org/tjdavid))
- 6257a0f feat: aggregate add meta value namespace - ([Thomas David](https://codeberg.org/tjdavid))
- 469d5fe feat: aggregate handle page sort - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.8
Previous version ---- v0.6.7
Total commits ------- 10
```

## Release: `v0.6.7`

### Changes from `v0.6.6` to `v0.6.7`

- 7138a0b (tag: v0.6.7) update repo url - ([Thomas David](https://codeberg.org/tjdavid))
- 41988a4 license change - ([Thomas David](https://codeberg.org/tjdavid))
- f471dbc chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.7
Previous version ---- v0.6.6
Total commits ------- 3
```

## Release: `v0.6.6`

### Changes from `v0.6.5` to `v0.6.6`

- 790c585 (tag: v0.6.6) fix: computedSlots token param includes attrib values - ([Thomas David](https://codeberg.org/tjdavid))
- 505d4f0 feat: export parseHTML util - ([Thomas David](https://codeberg.org/tjdavid))
- d0fc52d docs: update CoraliteModuleValues type - ([Thomas David](https://codeberg.org/tjdavid))
- 6ad27ce feat: tokens parse HTML - ([Thomas David](https://codeberg.org/tjdavid))
- 9497c25 feat: export current document to template context - ([Thomas David](https://codeberg.org/tjdavid))
- df9a1a5 refactor: create reusable parseHTML function - ([Thomas David](https://codeberg.org/tjdavid))
- ebb388c feat: append rendered token to custom element slots - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.6
Previous version ---- v0.6.5
Total commits ------- 7
```

## Release: `v0.6.5`

### Changes from `v0.6.4` to `v0.6.5`

- 4610baa (tag: v0.6.5) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- be2511d ci: remove windows due to unavailability - ([Thomas David](https://codeberg.org/tjdavid))
- 821f212 test: cover aggregate filter option - ([Thomas David](https://codeberg.org/tjdavid))
- 48eaa76 docs: add CoraliteAggregate to aggregate param - ([Thomas David](https://codeberg.org/tjdavid))
- 39ab5ba docs: add CoraliteAggregate typedef - ([Thomas David](https://codeberg.org/tjdavid))
- 148dee9 feat: add filter to aggregate function - ([Thomas David](https://codeberg.org/tjdavid))
- 15cf0fd docs: add CoraliteAggregate typedef - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.5
Previous version ---- v0.6.4
Total commits ------- 7
```

## Release: `v0.6.4`

### Changes from `v0.6.3` to `v0.6.4`

- 41771d5 (tag: v0.6.4) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- ea2ef46 test: cover values param - ([Thomas David](https://codeberg.org/tjdavid))
- 60e70d3 feat: add props argument to tokens and slots functions - ([Thomas David](https://codeberg.org/tjdavid))
- 1ed074a chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.4
Previous version ---- v0.6.3
Total commits ------- 4
```

## Release: `v0.6.3`

### Changes from `v0.6.2` to `v0.6.3`

- 6fe640d (tag: v0.6.3) test: cover ignore by attribute - ([Thomas David](https://codeberg.org/tjdavid))
- a47ff8f types: add IgnoreByAttribute type - ([Thomas David](https://codeberg.org/tjdavid))
- 8547c37 feat: ignore element by attributes inside meta and component parsers - ([Thomas David](https://codeberg.org/tjdavid))
- f61ae88 docs: update ignore-attribute example with quotes - ([Thomas David](https://codeberg.org/tjdavid))
- d4a277d docs: create consistent path names in example - ([Thomas David](https://codeberg.org/tjdavid))
- 566463f docs: remove requirements section - ([Thomas David](https://codeberg.org/tjdavid))
- 2493ab3 style: import type new line - ([Thomas David](https://codeberg.org/tjdavid))
- 2e44174 ci: test before publish - ([Thomas David](https://codeberg.org/tjdavid))
- c1d5ce7 fix: add template id to script module error - ([Thomas David](https://codeberg.org/tjdavid))
- 4fabac1 ci: include self to test script - ([Thomas David](https://codeberg.org/tjdavid))
- efd34d0 fix: add --experimental-vm-modules to shebang - ([Thomas David](https://codeberg.org/tjdavid))
- 7da5d98 refactor: add type check before splicing children. - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.3
Previous version ---- v0.6.2
Total commits ------- 12
```

## Release: `v0.6.2`

### Changes from `v0.6.1` to `v0.6.2`

- be6c54c (tag: v0.6.2) fix: update lock - ([Thomas David](https://codeberg.org/tjdavid))
- 15d9b4e chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- fac695e fix: node v18 requires globalThis reference for crypto - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.2
Previous version ---- v0.6.1
Total commits ------- 3
```

## Release: `v0.6.1`

### Changes from `v0.6.0` to `v0.6.1`

- bcc1637 (tag: v0.6.1) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 95cfdba docs: add doc links - ([Thomas David](https://codeberg.org/tjdavid))
- 101a305 fix: render computedSlot nodes - ([Thomas David](https://codeberg.org/tjdavid))
- 11a35d8 feat: dynamically import modules - ([Thomas David](https://codeberg.org/tjdavid))
- e1364b9 docs: add CoraliteResult type - ([Thomas David](https://codeberg.org/tjdavid))
- 11c6405 docs: add @example to coralite - ([Thomas David](https://codeberg.org/tjdavid))
- a050263 docs: basic technical documentation - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.1
Previous version ---- v0.6.0
Total commits ------- 7
```

## Release: `v0.6.0`

### Changes from `v0.5.1` to `v0.6.0`

- 22d75e2 (tag: v0.6.0) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- c5cc7cc lint: ignore playwright-report - ([Thomas David](https://codeberg.org/tjdavid))
- fdb3697 docs: add dry run option - ([Thomas David](https://codeberg.org/tjdavid))
- 891db2e feat: export coralite utils - ([Thomas David](https://codeberg.org/tjdavid))
- 9265681 test: cover ignore attribute - ([Thomas David](https://codeberg.org/tjdavid))
- 5d44661 fix: allow missing component to compile - ([Thomas David](https://codeberg.org/tjdavid))
- f3d6e65 docs: add remove prop to CoraliteElement - ([Thomas David](https://codeberg.org/tjdavid))
- 229fef5 feat: new option to ignore element by attribute name value pair - ([Thomas David](https://codeberg.org/tjdavid))
- c78dde1 chore: include kleur dep - ([Thomas David](https://codeberg.org/tjdavid))
- b10bbe8 feat: update cli to use coralite module - ([Thomas David](https://codeberg.org/tjdavid))
- 48fe816 docs: make defineComponent param tokens and slots optional - ([Thomas David](https://codeberg.org/tjdavid))
- 02a5e8f feat: move coralite to a module - ([Thomas David](https://codeberg.org/tjdavid))
- d336090 feat: get package.json util function - ([Thomas David](https://codeberg.org/tjdavid))
- e210844 feat: add document used in error message - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.6.0
Previous version ---- v0.5.1
Total commits ------- 14
```

## Release: `v0.5.1`

### Changes from `v0.5.0` to `v0.5.1`

- 8a47889 (tag: v0.5.1) feat: aggregate template accepts a string - ([Thomas David](https://codeberg.org/tjdavid))
- 13976c0 test: cover slot comments - ([Thomas David](https://codeberg.org/tjdavid))
- e53dcd1 fix: update template aggregate test - ([Thomas David](https://codeberg.org/tjdavid))
- fca64e7 feat: include crypto in contextified object - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.5.1
Previous version ---- v0.5.0
Total commits ------- 4
```

## Release: `v0.5.0`

### Changes from `v0.4.2` to `v0.5.0`

- f785362 (tag: v0.5.0) chore: ignore unused files for npm - ([Thomas David](https://codeberg.org/tjdavid))
- 0270c62 chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 585aa25 test: cover defineComponent slot functions - ([Thomas David](https://codeberg.org/tjdavid))
- 5786401 feat: defineComponent can manipulate named slot content - ([Thomas David](https://codeberg.org/tjdavid))
- bfa4bf9 test: cover named slot in body - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.5.0
Previous version ---- v0.4.2
Total commits ------- 5
```

## Release: `v0.4.2`

### Changes from `v0.4.1` to `v0.4.2`

- 167efbb (tag: v0.4.2) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 8de7412 style: lint test - ([Thomas David](https://codeberg.org/tjdavid))
- 58eaceb style: lint script naming convention - ([Thomas David](https://codeberg.org/tjdavid))
- b4a9fda fix: resolve package.json - ([Thomas David](https://codeberg.org/tjdavid))
- bdad6e8 test: update fixtures - ([Thomas David](https://codeberg.org/tjdavid))
- 0385d43 docs: rename getting-started to basic-templating - ([Thomas David](https://codeberg.org/tjdavid))
- 3a7bb15 docs: getting started with templating - ([Thomas David](https://codeberg.org/tjdavid))
- e161908 test: add e2e tests for aggregate content - ([Thomas David](https://codeberg.org/tjdavid))
- 5a75bbe style: remove whitespace - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.4.2
Previous version ---- v0.4.1
Total commits ------- 9
```

## Release: `v0.4.1`

### Changes from `v0.4.0` to `v0.4.1`

- 6865334 (tag: v0.4.1) chore: update .npmignore with new ignored patterns - ([Thomas David](https://codeberg.org/tjdavid))
- c81a9d8 types: improve coralite types with better definitions - ([Thomas David](https://codeberg.org/tjdavid))
    - Added `CoraliteModuleValues` as a proper type definition for module value tokens.
    - Corrected parameter types in functions to use the new typing.
    - Enhanced `CoraliteTextNodeToken` structure for better clarity.
    
    This refactoring ensures consistent and accurate type usage throughout the codebase.

- 1ee6777 refactor: ensure attribute and text replacements handle string values correctly - ([Thomas David](https://codeberg.org/tjdavid))
- 186d946 fix: skip parsing non tag nodes - ([Thomas David](https://codeberg.org/tjdavid))
- b146a5e refactor: move managing the parse stack out of external functions - ([Thomas David](https://codeberg.org/tjdavid))
- 32d7fb0 refactor: improve comment handling by using spread operator - ([Thomas David](https://codeberg.org/tjdavid))
- 21d53ea fix: remove conditional creation of text nodes to include original text - ([Thomas David](https://codeberg.org/tjdavid))
- e6b1894 fix: replace the custom element - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.4.1
Previous version ---- v0.4.0
Total commits ------- 8
```

## Release: `v0.4.0`

### Changes from `v0.3.0` to `v0.4.0`

- 30974ff (tag: v0.4.0) chore: version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 42fd689 fix: update html script to use the -t option - ([Thomas David](https://codeberg.org/tjdavid))
- 53d1b6e docs: Update documentation for template handling. - ([Thomas David](https://codeberg.org/tjdavid))
    Update documentation to reflect that the -t option refers to templates rather than components.

- 3681e58 types: update CoralitePath type to use templates - ([Thomas David](https://codeberg.org/tjdavid))
- 5779ec4 types: remove unsed param from createComponent - ([Thomas David](https://codeberg.org/tjdavid))
- 8dae1b1 ci: remove debugger env - ([Thomas David](https://codeberg.org/tjdavid))
- 8081be5 types: remove unused markdown style - ([Thomas David](https://codeberg.org/tjdavid))
- 017c0bf feat: replace -c/--components option with -t/--templates - ([Thomas David](https://codeberg.org/tjdavid))
    This change renames the components option to templates, reflecting the new functionality.
    
    BREAKING CHANGE: The -c/--components option has been deprecated in favor of -t/--templates.

- bcf8a34 refactor: move component files to templates directory - ([Thomas David](https://codeberg.org/tjdavid))
- b80d5af ci:  change playwright url - ([Thomas David](https://codeberg.org/tjdavid))
- 9372071 ci: add debug webserver for playwright - ([Thomas David](https://codeberg.org/tjdavid))
- 0bad428 ci: update dev server configuration - ([Thomas David](https://codeberg.org/tjdavid))
- 05fd58a ci: e2e only cover one browser - ([Thomas David](https://codeberg.org/tjdavid))
- 28f55a3 fix: start local server for e2e cli - ([Thomas David](https://codeberg.org/tjdavid))
- 26591fd ci: run server for e2e - ([Thomas David](https://codeberg.org/tjdavid))
- 13a7846 ci: add --experimental-vm-modules to html script - ([Thomas David](https://codeberg.org/tjdavid))
- b134950 ci: add e2e on push and pull_request - ([Thomas David](https://codeberg.org/tjdavid))
- b450b9c test: add e2e test covering index.html - ([Thomas David](https://codeberg.org/tjdavid))
- ba7f1e8 test: remove old test spec files - ([Thomas David](https://codeberg.org/tjdavid))
- 1858afb test: move fixtures - ([Thomas David](https://codeberg.org/tjdavid))
- 114ef7b ci: include playright config - ([Thomas David](https://codeberg.org/tjdavid))
- 0c4e500 chore: add playwright package - ([Thomas David](https://codeberg.org/tjdavid))
- db4f489 chore: add playwright to gitignore - ([Thomas David](https://codeberg.org/tjdavid))
- aa43fe4 types: add parent property to CoraliteTextNode - ([Thomas David](https://codeberg.org/tjdavid))
- 69da214 types: add CoraliteComment Type Definition - ([Thomas David](https://codeberg.org/tjdavid))
- a4bc806 fix: implement createTextNode function with parent check - ([Thomas David](https://codeberg.org/tjdavid))
    Add parent.children check before pushing child node to prevent potential issues.

- fdeddb7 docs: update createTextNode documentation - ([Thomas David](https://codeberg.org/tjdavid))
- 026ab0d docs: fix node option - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.4.0
Previous version ---- v0.3.0
Total commits ------- 28
```

## Release: `v0.3.0`

### Changes from `v0.2.1` to `v0.3.0`

- 83fb6cf (tag: v0.3.0) chore: Bump version to 0.3.0 - ([Thomas David](https://codeberg.org/tjdavid))
- e4e44c6 build: update Node.js version in workflow to 22 - ([Thomas David](https://codeberg.org/tjdavid))
- bfe9b2c Merge pull request #3 from tjdav/default-slots - ([Thomas David](https://codeberg.org/tjdavid))
    Default slots

- 1c77286 (origin/default-slots, default-slots) types: add jsdoc documentation for the element option in parseModule function - ([Thomas David](https://codeberg.org/tjdavid))
- 5d19343 types: remove unused types - ([Thomas David](https://codeberg.org/tjdavid))
- a523568 feat: refactor component initialization naming - ([Thomas David](https://codeberg.org/tjdavid))
    Refactor: Renamed 'components' to 'coraliteModules' for better naming consistency.

- 2a116c1 Fix: correct attribute handling in component parsing - ([Thomas David](https://codeberg.org/tjdavid))
- ebe6299 refactor: update parseModule function signature with new element parameter replacing customElementSlots - ([Thomas David](https://codeberg.org/tjdavid))
- 0f5a8e3 fix: add head element validation during parsing - ([Thomas David](https://codeberg.org/tjdavid))
- a19cfe4 feat: add slot handling for custom elements. - ([Thomas David](https://codeberg.org/tjdavid))
- 3bf99cf feat: refactor comment handling to use data property - ([Thomas David](https://codeberg.org/tjdavid))
- 2efcab0 feat: improve slot handling and default content insertion - ([Thomas David](https://codeberg.org/tjdavid))
- c959147 docs: update JSDoc comments and examples in `parse.js`. - ([Thomas David](https://codeberg.org/tjdavid))
- a8b329d feat: start stack with root element - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.3.0
Previous version ---- v0.2.1
Total commits ------- 14
```

## Release: `v0.2.1`

### Changes from `v0.2.0` to `v0.2.1`

- f9d999a (tag: v0.2.1) fix: parse root elements to allow level layout components - ([Thomas David](https://codeberg.org/tjdavid))
- a4ead0b ci: release notes - ([Thomas David](https://codeberg.org/tjdavid))
- 2a4630d feat: include svg tags - ([Thomas David](https://codeberg.org/tjdavid))
- c90ffb9 test: add tests for getHTML - ([Thomas David](https://codeberg.org/tjdavid))
- e2b9d7a chore: remove unused  package acorn - ([Thomas David](https://codeberg.org/tjdavid))
- 04047b5 chore: remove unused config - ([Thomas David](https://codeberg.org/tjdavid))
- a9a5bbf chore: remove eval-estree-expression - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.2.1
Previous version ---- v0.2.0
Total commits ------- 7
```

## Release: `v0.2.0`

### Changes from `v0.1.1` to `v0.2.0`

- c0e2e5e (tag: v0.2.0) ci: remove publish-npm pull-request permission - ([Thomas David](https://codeberg.org/tjdavid))
- 024a885 ci: remove workflows dir - ([Thomas David](https://codeberg.org/tjdavid))
- c24e050 ci: publish - ([Thomas David](https://codeberg.org/tjdavid))
- b4fe850 ci: add semantic-release github - ([Thomas David](https://codeberg.org/tjdavid))
- 931adac feat:add semantic-release - ([Thomas David](https://codeberg.org/tjdavid))
- 455d3d1 fix: use export default - ([Thomas David](https://codeberg.org/tjdavid))
- 7cdb7eb feat: add commit lint - ([Thomas David](https://codeberg.org/tjdavid))
- 4b9ffd7 feat: update engine versions - ([Thomas David](https://codeberg.org/tjdavid))
- 6cbafad Rewrite of Coralite template due to regex limitations - ([Thomas David](https://codeberg.org/tjdavid))
    ### Overview of Changes:
    
    1. **Switch to HTML Parsing:**
       - The decision to replace regex with HTML parsing provides a more robust and compatible approach for processing structured data. This change is expected to enhance the library's ability to handle complex document formats effectively.
    
    2. **New Features and Improvements:**
       - **getHTML Functionality:** Enhanced to support non-recursive requests, improving its utility in various web scraping scenarios.
       - **Page Aggregation:** Introduction of a new feature to aggregate data from multiple pages, expanding the library's analytical capabilities.
       - **Improved Module Parsing:** Significant rework of module parsing and component creation for better handling of complex components.
    
    3. **Code Improvements:**
       - **Documentation Enhancements:** Extensive updates to JSDoc comments for all functions, providing clearer guidance for developers.
    
    4. **Deprecation and Cleanup:**
       - Several older features and unused files (e.g., `remove unused files` commit) are being deprecated or removed as part of this refactor.

- 90df901 (origin/slots, slots) docs: revert readme - ([Thomas David](https://codeberg.org/tjdavid))
- b7b2b1c Merge branch 'main' into slots - ([Thomas David](https://codeberg.org/tjdavid))
- 427bb48 types: add parse root and directives - ([Thomas David](https://codeberg.org/tjdavid))
- ea4fd35 test: update coralite-posts attribute - ([Thomas David](https://codeberg.org/tjdavid))
- 272581c test: add slots to fixtures - ([Thomas David](https://codeberg.org/tjdavid))
- 6e2cdba fix: remove unused code - ([Thomas David](https://codeberg.org/tjdavid))
- 6943970 feat: parse html directives - ([Thomas David](https://codeberg.org/tjdavid))
- a4c6790 fix: createTextNode type to 'text' - ([Thomas David](https://codeberg.org/tjdavid))
- 861c932 refactor: move html module functions to html-modules.js - ([Thomas David](https://codeberg.org/tjdavid))
- fbf58d6 feat: placeholder html module coralite exports - ([Thomas David](https://codeberg.org/tjdavid))
- b91d020 types: Update JSDoc comments for Coralite types - ([Thomas David](https://codeberg.org/tjdavid))
- b85b074 types: Add JSDoc comments and improve documentation for parseScript function - ([Thomas David](https://codeberg.org/tjdavid))
- 5e7b863 types: Update createComponent with new configuration parameters - ([Thomas David](https://codeberg.org/tjdavid))
    Enhance the createComponent function to accept id, values, customElementSlots, and components parameters, improving configuration flexibility.

- 70e7a3c types: Document module parsing with examples - ([Thomas David](https://codeberg.org/tjdavid))
    Added JSDoc example for parseModule function to clarify usage.
    Ensured documentation aligns with recent module parsing functionality.

- 52cb651 types: fix type imports - ([Thomas David](https://codeberg.org/tjdavid))
- bfdb95a types: improve JSDoc for parseHTMLMeta function - ([Thomas David](https://codeberg.org/tjdavid))
- df3e59d types: improve JSDoc for parseHTMLDocument function - Enhanced documentation with example usage and clearer description - ([Thomas David](https://codeberg.org/tjdavid))
- 66abb35 feat: update getHTML function to handle non-recursive requests by default - ([Thomas David](https://codeberg.org/tjdavid))
- 8b8b618 types: add type descriptions to getHTML function - ([Thomas David](https://codeberg.org/tjdavid))
- 522b407 refactor: move to using defineComponent for better token handling. - ([Thomas David](https://codeberg.org/tjdavid))
- 26d0746 refactor: module import reorganization - ([Thomas David](https://codeberg.org/tjdavid))
- f9d3d5d update lock - ([Thomas David](https://codeberg.org/tjdavid))
- 7e474ff build: update JavaScript target to ES2022 - ([Thomas David](https://codeberg.org/tjdavid))
- e683221 feat: Update package.json with new dependencies and build configuration - ([Thomas David](https://codeberg.org/tjdavid))
    This change updates the package.json file by adding new dependencies required for HTML parsing and other improvements. Additionally, it restructures the binary configuration to use a dedicated executable file.

- 22afc38 feat: add page aggregation functionality to coralite cli - ([Thomas David](https://codeberg.org/tjdavid))
    This change introduces an `aggregate` function in `lib/coralite.js` that fetches pages and processes metadata, enabling dynamic content aggregation from multiple sources.

- fb7420e feat: improve module parsing and component creation - ([Thomas David](https://codeberg.org/tjdavid))
    Replace `getComponentFromString` with `parseModule` for ES modules support. Add slot handling and improve component rendering logic.

- f32b5b2 feat: parse coralite documents - ([Thomas David](https://codeberg.org/tjdavid))
- 0a33387 feat: get sub direction - ([Thomas David](https://codeberg.org/tjdavid))
- 12ec1fd feat: tag schema - ([Thomas David](https://codeberg.org/tjdavid))
- 62434ec remove unused files - ([Thomas David](https://codeberg.org/tjdavid))
- 4b68332 feat: extract slots from string - ([Thomas David](https://codeberg.org/tjdavid))
- 510d1b2 docs(core): remove duplicate description - ([Thomas David](https://codeberg.org/tjdavid))
- 2122961 docs(core): usage guide - ([Thomas David](https://codeberg.org/tjdavid))
- b8c01b1 docs(core): added descriptions to typedefs - ([Thomas David](https://codeberg.org/tjdavid))
- c431ec1 feat(script): include test script - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
This version -------- v0.2.0
Previous version ---- v0.1.1
Total commits ------- 44
```

## Initial Release: `v0.1.1`

### Initial Commits

- d71c315 (tag: v0.1.1) chore(core) version bump - ([Thomas David](https://codeberg.org/tjdavid))
- 504dd0c fix(compat): node v18 < Dirent use path - ([Thomas David](https://codeberg.org/tjdavid))
- ab5b860 Merge pull request #1 from ajdavid/main - ([Thomas David](https://codeberg.org/tjdavid))
    fix(core): typo in package.json

- d658f47 fix(core): typo in package.json - (*Anthony David*)
- 79f67aa (coralite) init readme - ([Thomas David](https://codeberg.org/tjdavid))
- 87dd1b8 add keywords - ([Thomas David](https://codeberg.org/tjdavid))
- e3c9ece npm ignore - ([Thomas David](https://codeberg.org/tjdavid))
- deb60bb include license - ([Thomas David](https://codeberg.org/tjdavid))
- c3e2af1 feat(resolve): export evalComputedTokens - ([Thomas David](https://codeberg.org/tjdavid))
- acbcbc0 test(merge): fix lib import - ([Thomas David](https://codeberg.org/tjdavid))
- 993b261 test(tokens): fix lib import - ([Thomas David](https://codeberg.org/tjdavid))
- 76bf841 test(script): fix lib import - ([Thomas David](https://codeberg.org/tjdavid))
- 04400bf test(metadata): fix lib import - ([Thomas David](https://codeberg.org/tjdavid))
- 7f3d273 test(component): expect CoraliteToken - ([Thomas David](https://codeberg.org/tjdavid))
- 26e27b5 test(eval): resolve promise - ([Thomas David](https://codeberg.org/tjdavid))
- 8239abf test(component): activate all tests - ([Thomas David](https://codeberg.org/tjdavid))
- f8bc817 types(core): create global types file - ([Thomas David](https://codeberg.org/tjdavid))
- 7a62315 fix(config): not resolving json - ([Thomas David](https://codeberg.org/tjdavid))
- a04cd3b fix(render): catch undefined values - ([Thomas David](https://codeberg.org/tjdavid))
- 3ead671 fix(parsing): avoid catching scripts inside template by removing it - ([Thomas David](https://codeberg.org/tjdavid))
- 718a086 fix(core): resolve package.json - ([Thomas David](https://codeberg.org/tjdavid))
- 100dd29 fix(regex): catch multiple dashed custom elements - ([Thomas David](https://codeberg.org/tjdavid))
- 099c163 test(core): move fixtures into tests dir - ([Thomas David](https://codeberg.org/tjdavid))
- 1bf0498 feat(package): update script location - ([Thomas David](https://codeberg.org/tjdavid))
- 84fbb5c feat(cli): move cli script to bin - ([Thomas David](https://codeberg.org/tjdavid))
- b35cb9f feat(core): compile documents - ([Thomas David](https://codeberg.org/tjdavid))
- 2f80072 feat(component): resolve component based on refactored functions - ([Thomas David](https://codeberg.org/tjdavid))
- ec398ae test(fixtures): replace name with nemo - ([Thomas David](https://codeberg.org/tjdavid))
- 0b675f9 feat(component): simplify token replacement - ([Thomas David](https://codeberg.org/tjdavid))
- 922d87b feat(custom-element): simplify token replacement - ([Thomas David](https://codeberg.org/tjdavid))
- 6643054 types(custom-element): fix property type - ([Thomas David](https://codeberg.org/tjdavid))
- 8d21137 common files - ([Thomas David](https://codeberg.org/tjdavid))
- 43552c9 feat(token): replace attribute tokens - ([Thomas David](https://codeberg.org/tjdavid))
- ed7f226 feat(tokens): prepare token data for replacement - ([Thomas David](https://codeberg.org/tjdavid))
- c09e4ea update git coverage - ([Thomas David](https://codeberg.org/tjdavid))
- 06cede9 fix(component): avoid name conflicts, move tokens into tokens property - ([Thomas David](https://codeberg.org/tjdavid))
- 23328c5 fix(render): replace tokens - ([Thomas David](https://codeberg.org/tjdavid))
- 14200db fix(script): always return a async function - ([Thomas David](https://codeberg.org/tjdavid))
- ed6c3be feat(attributes): replace attribute tokens with values - ([Thomas David](https://codeberg.org/tjdavid))
- 3267cd2 test(script): computedTokens is async - ([Thomas David](https://codeberg.org/tjdavid))
- b1afce6 feat(util): get subdirectory from base path - ([Thomas David](https://codeberg.org/tjdavid))
- 322412c types(metadata): CoraliteMeta content is a string - ([Thomas David](https://codeberg.org/tjdavid))
- 22991ab test(fixtures): update custom element names - ([Thomas David](https://codeberg.org/tjdavid))
- 32ab464 feat(template): update params - ([Thomas David](https://codeberg.org/tjdavid))
- 82d3bf4 feat(component): add createContext function - ([Thomas David](https://codeberg.org/tjdavid))
- f93ef5a wip(script): slightly improve regex pattern - ([Thomas David](https://codeberg.org/tjdavid))
- 063fac1 feat(get-html): add exclude option - ([Thomas David](https://codeberg.org/tjdavid))
- a10b37d feat(tokens): generalise context param - ([Thomas David](https://codeberg.org/tjdavid))
- 54f6b31 fix(component): regex covers custom element dashes - ([Thomas David](https://codeberg.org/tjdavid))
- a532eee fix(get-html): resolve file path - ([Thomas David](https://codeberg.org/tjdavid))
- 9d26134 feat(args): use commander to manage args - ([Thomas David](https://codeberg.org/tjdavid))
- abed6bf kebab case file names - ([Thomas David](https://codeberg.org/tjdavid))
- bb30539 kebab case file names - ([Thomas David](https://codeberg.org/tjdavid))
- e7eb604 test(document): use direct import of getMetadataFromDocument - ([Thomas David](https://codeberg.org/tjdavid))
- 7f7aa88 test(document): cover merge document - ([Thomas David](https://codeberg.org/tjdavid))
- 4016aac test(component): update getScriptFromString to use computedTokens - ([Thomas David](https://codeberg.org/tjdavid))
- 508d239 types(component): make components optional - ([Thomas David](https://codeberg.org/tjdavid))
- 30e3159 test(component): update getComponentFromString results - ([Thomas David](https://codeberg.org/tjdavid))
- 802e0eb test(component): update render arguments - ([Thomas David](https://codeberg.org/tjdavid))
- 9ccda99 fix(template): use correct property - ([Thomas David](https://codeberg.org/tjdavid))
- 69a9565 feat(template): render components - ([Thomas David](https://codeberg.org/tjdavid))
- ad131db refactor(template): script only needs to fetch the first tag - ([Thomas David](https://codeberg.org/tjdavid))
- 92265fd feat(template): extract computedTokens and elements - ([Thomas David](https://codeberg.org/tjdavid))
- 7bbdd19 feat(args): change template to components - ([Thomas David](https://codeberg.org/tjdavid))
- dbd090b feat(template): extract nested custom elements - ([Thomas David](https://codeberg.org/tjdavid))
- cc00c55 feat(template): extract custom elements from string - ([Thomas David](https://codeberg.org/tjdavid))
- bda05f5 eslint config - ([Thomas David](https://codeberg.org/tjdavid))
- 0ee471d fix lint - ([Thomas David](https://codeberg.org/tjdavid))
- 43d1827 add eslint - ([Thomas David](https://codeberg.org/tjdavid))
- 7bcfa9d types(component): update Coralite type location - ([Thomas David](https://codeberg.org/tjdavid))
- 8d38460 test(component) cover render function - ([Thomas David](https://codeberg.org/tjdavid))
- e05dc08 feat(component): render component - ([Thomas David](https://codeberg.org/tjdavid))
- 7c9c9a4 rename evalComputedAttributes to evalComputedTokens - ([Thomas David](https://codeberg.org/tjdavid))
- eba507d rename getAttributesFromString to getTokensFromString - ([Thomas David](https://codeberg.org/tjdavid))
- 64ac8a7 rename getTemplateFromString to getComponentFromString - ([Thomas David](https://codeberg.org/tjdavid))
- c9f0583 rename mergeTemplateToPage to mergeComponentToDocument - ([Thomas David](https://codeberg.org/tjdavid))
- 774511b rename defineProps to computedAttributes - ([Thomas David](https://codeberg.org/tjdavid))
- 63641ec rename parseProperties to evalComputedAttributes - ([Thomas David](https://codeberg.org/tjdavid))
- 6bb6000 feat(scrape): extract metadata from document - ([Thomas David](https://codeberg.org/tjdavid))
- 5df4224 docs(license): update licence - ([Thomas David](https://codeberg.org/tjdavid))
- a10b061 feat(parse): parse script tag - ([Thomas David](https://codeberg.org/tjdavid))
- 73e6436 feat(template): parse computed properties - ([Thomas David](https://codeberg.org/tjdavid))
- a1ba2bb feat(defineProps): script function to create computed props - ([Thomas David](https://codeberg.org/tjdavid))
- 26ea1a8 test(template): extract props from template inner text - ([Thomas David](https://codeberg.org/tjdavid))
- bd492a0 feat(props): extract props from string - ([Thomas David](https://codeberg.org/tjdavid))
- 5a3b13d rename getTemplateFromHTML to getTemplateFromString - ([Thomas David](https://codeberg.org/tjdavid))

### Metadata
```
First version ------- v0.1.1
Total commits ------- 86
```

## Summary
```
Total releases ------ 32
Total commits ------- 526
```
