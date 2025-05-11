# 🎁 Release notes (`v0.8.0`)

## Changes
- 25c4669 (HEAD -> main, tag: v0.8.0, origin/main) feat(aggregate): add pagination support - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 1268e3c fix(aggregate): handle non-array metadata values correctly - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 42c3ae0 fix(aggregate): handle string and non-array limit values correctly - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 0538a80 fix(aggregate): Handle offset parsing robustly for numeric conversion - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 4d2fe56 feat(aggregate): Add metadata-based page filtering using options.filter - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 176c7f3 feat(lib/html-module): add support for custom sort function in aggregate - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 3acfb99 feat(lib/html-module): add pagination support with token validation - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 41b0e10 refactor(lib): integrate htmlparser2 and dom-serializer for improved HTML parsing - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 0c7fb5e refactor(html-module): update aggregate to use component element children and return Aggregation object - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 6bb83d3 refactor: restructure document rendering logic and add HTMLData type support - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 8d4b43c refactor: move coralite rendering logic to new renderDocument function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c81786e types: add pagination configuration to CoraliteAggregate - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c8ddec4 feat(metadata): Update metadata token prefix to '$' - (*[Thomas David](https://codeberg.org/tjdavid)*)
- ee57e18 feat: add parsePagination function for handling pagination templates - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 4471482 types: add Aggregation typedef and update imports - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2772969 docs: Improve JSDoc clarity for parseHTMLDocument function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 37e79db refactor: restructure html file path properties - (*[Thomas David](https://codeberg.org/tjdavid)*)
- dab3a61 refactor: Export createTextNode function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c538186 fix: handle custom element creation with proper tag validation - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 58d101d refactor: update addMetadata to support non-array values as array of objects - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d0fa67c docs: update parseHTMLMeta parameters and example documentation - (*[Thomas David](https://codeberg.org/tjdavid)*)
- de8035e fix: correct path calculation in parseScript function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- b9c94ee refactor(parse): use scriptResult.values instead of computedValues when merging values - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 7b0be0c fix: correct script parsing path resolution and module identifier - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 803aa3e refactor(parse): refactor aggregate method to use helper and collect documents - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2c77b44 fix: add warning when component is not found - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 885fd6c refactor(parseModule): remove html parameter and introduce lineOffset property - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 84c8a74 types: allow string or CoraliteToken[] as meta value types - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 0b9ce81 refactor: merge html.path into path object in parseHTMLDocument - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 1964a60 types: update JSDoc types for aggregate callbacks - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2205c1a types: Refactor types to introduce CoraliteFilePath and improve module interface definitions - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c37fa7c docs: add CoraliteComponent import - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 281e07e refactor: rename getHTML to getHtmlFiles and add getHtmlFile function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f91251a types: Update return type of createComponent to CoraliteComponent - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d6fab1e refactor: use cleanKeys for consistent naming conventions - (*[Thomas David](https://codeberg.org/tjdavid)*)
- dfe3b06 docs: update aggregate comments - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 6a495f3 feat: add document data to  component - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 17afeb4 feat: require experimental-import-meta-resolve for dynamic imports - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 34ccd76 feat: dynamic module linker - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 828bcaa feat: add console to script context - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 47ab7db chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 4c7f361 fix kleur dependencies - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2f88f2d chore: update changelong - (*[Thomas David](https://codeberg.org/tjdavid)*)
- aedf75f chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.8.0
Previous version ---- v0.7.0
Total commits ------- 44
```
# 🎁 Release notes (`v0.7.0`)

## Changes
- d7b183d (HEAD -> main, tag: v0.7.0, origin/main) fix: use type helper to confirm child is a node - (*[Thomas David](https://codeberg.org/tjdavid)*)
- b574569 feat: check if slot is a node - (*[Thomas David](https://codeberg.org/tjdavid)*)
- de05e38 feat: type helper functions - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 24f3935 test: cover nested components attributes - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 8dc8f5d fix: apply nested custom component attribute values - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 3fa3eb5 chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.7.0
Previous version ---- v0.6.9
Total commits ------- 6
```
# 🎁 Release notes (`v0.6.9`)

## Changes
- e79d7c9 (HEAD -> main, tag: v0.6.9, origin/main) fix: aggregation limit is offset by offset - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 6f8253f test: cover nested document root components - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 77d0e36 feat: create nested custom elements on  document root - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2c176e5 chore: update changelog - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f5a3639 chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.9
Previous version ---- v0.6.8
Total commits ------- 5
```
# 🎁 Release notes (`v0.6.8`)

## Changes
- 3b8fe8c (tag: v0.6.8, origin/main) test: use parseHTML - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f7d6ab9 test: add meta prefix to tokens - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 34c15d2 test: remove unused variables - (*[Thomas David](https://codeberg.org/tjdavid)*)
- b39ac47 test: cover nested components - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 81c3da4 feat: computed slots parse strings - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 585b7d6 fix: remove slot attribute - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 00f68ef fix: process computed tokens before replacing values - (*[Thomas David](https://codeberg.org/tjdavid)*)
- b13a016 feat: add identifier to SourceTextModule - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 6257a0f feat: aggregate add meta value namespace - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 469d5fe feat: aggregate handle page sort - (*[Thomas David](https://codeberg.org/tjdavid)*)
- bd23fbe feat: aggregate handle page limit - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.8
Previous version ---- v0.6.7
Total commits ------- 11
```
# 🎁 Release notes (`v0.6.7`)

## Changes
- 7138a0b (HEAD -> main, tag: v0.6.7, origin/main) update repo url - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 41988a4 license change - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f471dbc chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 095e35c fix: aggregate filter single meta item - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.7
Previous version ---- v0.6.6
Total commits ------- 4
```
# 🎁 Release notes (`v0.6.6`)

## Changes
- 790c585 (HEAD -> main, tag: v0.6.6, origin/main) fix: computedSlots token param includes attrib values - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 505d4f0 feat: export parseHTML util - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d0fc52d docs: update CoraliteModuleValues type - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 6ad27ce feat: tokens parse HTML - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 9497c25 feat: export current document to template context - (*[Thomas David](https://codeberg.org/tjdavid)*)
- df9a1a5 refactor: create reusable parseHTML function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- ebb388c feat: append rendered token to custom element slots - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 1f6ffd0 feat: add filtering to aggregate function - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.6
Previous version ---- v0.6.5
Total commits ------- 8
```
# 🎁 Release notes (`v0.6.5`)

## Changes
- 4610baa (HEAD -> main, tag: v0.6.5, origin/main) chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- be2511d ci: remove windows due to unavailability - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 821f212 test: cover aggregate filter option - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 48eaa76 docs: add CoraliteAggregate to aggregate param - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 39ab5ba docs: add CoraliteAggregate typedef - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 148dee9 feat: add filter to aggregate function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 15cf0fd docs: add CoraliteAggregate typedef - (*[Thomas David](https://codeberg.org/tjdavid)*)
- dbb5b8f feat: remove unused  parseHTMLMeta ignoreByAttribute param - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.5
Previous version ---- v0.6.4
Total commits ------- 8
```
# 🎁 Release notes (`v0.6.4`)

## Changes
- 41771d5 (HEAD -> main, tag: v0.6.4, origin/main) chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- ea2ef46 test: cover values param - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 60e70d3 feat: add props argument to tokens and slots functions - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 1ed074a chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 9d710c0 ci: fix publish needs ref - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.4
Previous version ---- v0.6.3
Total commits ------- 5
```

# 🎁 Release notes (`v0.6.3`)

## Changes
- 6fe640d (HEAD -> main, tag: v0.6.3, origin/main) test: cover ignore by attribute - (*[Thomas David](https://codeberg.org/tjdavid)*)
- a47ff8f types: add IgnoreByAttribute type - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 8547c37 feat: ignore element by attributes inside meta and component parsers - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f61ae88 docs: update ignore-attribute example with quotes - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d4a277d docs: create consistent path names in example - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 566463f docs: remove requirements section - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2493ab3 style: import type new line - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2e44174 ci: test before publish - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c1d5ce7 fix: add template id to script module error - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 4fabac1 ci: include self to test script - (*[Thomas David](https://codeberg.org/tjdavid)*)
- efd34d0 fix: add --experimental-vm-modules to shebang - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 7da5d98 refactor: add type check before splicing children. - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 2e39027 fix: catch bad options for aggregate function - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.3
Previous version ---- v0.6.2
Total commits ------- 13
```
# 🎁 Release notes (`v0.6.2`)

## Changes
- be6c54c (HEAD -> main, tag: v0.6.2, origin/main) fix: update lock - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 15d9b4e chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- fac695e fix: node v18 requires globalThis reference for crypto - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d7c551e doc: format doc links - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.2
Previous version ---- v0.6.1
Total commits ------- 4
```
# 🎁 Release notes (`v0.6.1`)

## Changes
- bcc1637 (HEAD -> main, tag: v0.6.1, origin/main) chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 95cfdba docs: add doc links - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 101a305 fix: render computedSlot nodes - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 11a35d8 feat: dynamically import modules - (*[Thomas David](https://codeberg.org/tjdavid)*)
- e1364b9 docs: add CoraliteResult type - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 11c6405 docs: add @example to coralite - (*[Thomas David](https://codeberg.org/tjdavid)*)
- a050263 docs: basic technical documentation - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 83fdddd docs: update dry run option - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.1
Previous version ---- v0.6.0
Total commits ------- 8
```
# 🎁 Release notes (`v0.6.0`)

## Changes
- 22d75e2 (HEAD -> main, tag: v0.6.0, origin/main) chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c5cc7cc lint: ignore playwright-report - (*[Thomas David](https://codeberg.org/tjdavid)*)
- fdb3697 docs: add dry run option - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 891db2e feat: export coralite utils - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 9265681 test: cover ignore attribute - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 5d44661 fix: allow missing component to compile - (*[Thomas David](https://codeberg.org/tjdavid)*)
- f3d6e65 docs: add remove prop to CoraliteElement - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 229fef5 feat: new option to ignore element by attribute name value pair - (*[Thomas David](https://codeberg.org/tjdavid)*)
- c78dde1 chore: include kleur dep - (*[Thomas David](https://codeberg.org/tjdavid)*)
- b10bbe8 feat: update cli to use coralite module - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 48fe816 docs: make defineComponent param tokens and slots optional - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 02a5e8f feat: move coralite to a module - (*[Thomas David](https://codeberg.org/tjdavid)*)
- d336090 feat: get package.json util function - (*[Thomas David](https://codeberg.org/tjdavid)*)
- e210844 feat: add document used in error message - (*[Thomas David](https://codeberg.org/tjdavid)*)
- 1556a3b chore: version bump - (*[Thomas David](https://codeberg.org/tjdavid)*)

## Metadata
```
This version -------- v0.6.0
Previous version ---- v0.5.1
Total commits ------- 15
```