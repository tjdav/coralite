# Changelog

## v0.31.3

> Comparing `coralite-v0.31.2` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- define CoraliteModuleTokenFunction (types) ([7f7243b](https://codeberg.org/tjdavid/coralite/commit/7f7243ba5a05c50da2c7696a73d9a9a60ceb3c5a))
- define CoraliteModuleSlotFunction (types) ([eced451](https://codeberg.org/tjdavid/coralite/commit/eced451678a7ab0bf89d0a879ccd12dad67fa3a9))
- implement client-side reactivity for computed slots in web components ([e8ffe19](https://codeberg.org/tjdavid/coralite/commit/e8ffe196b732f86d5d100a58dbaad982acf09289))

### 🐛 Bug Fixes

- allow imperative component tokens to remain reactive ([a0ca589](https://codeberg.org/tjdavid/coralite/commit/a0ca589f83e3914bf7a8c623e343d92638240e2d))
- correctly pass tokens to imperative components without client.script ([eca9494](https://codeberg.org/tjdavid/coralite/commit/eca94943ffaae42838b69fc8d745f23fc301e530))


## v0.31.2

> Comparing `coralite-v0.31.1` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- prevent parent components from overriding nested child component refs ([8b8a545](https://codeberg.org/tjdavid/coralite/commit/8b8a5452695c117b42d579407b5f0f0590c31590))
- set correct web component ref attribute value ([6c35557](https://codeberg.org/tjdavid/coralite/commit/6c3555792e2398ab134e6847eb900cf6f0983096))


## v0.31.1

> Comparing `coralite-v0.31.0` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- emulate native slot projection for light dom web components ([5b43e83](https://codeberg.org/tjdavid/coralite/commit/5b43e835adee0acb450b62d78e584aac7ecfbc2f))


## v0.31.0

> Comparing `coralite-v0.30.0` to `HEAD`

**Summary:** 3 commits

### 🐛 Bug Fixes

- apply scoped style wrapper to dynamic web components (client) ([3c6998d](https://codeberg.org/tjdavid/coralite/commit/3c6998d5f2545cfc893056d4f9ba91666e7c38fd))
- prevent double export default in script fallback ([1006ea3](https://codeberg.org/tjdavid/coralite/commit/1006ea36bfc666ca7332f97776cc5e22e0d8a741))
- scope CSS within web components inside Light DOM (coralite) ([d4f170a](https://codeberg.org/tjdavid/coralite/commit/d4f170a2012ab4c06941322b98496f9828a3b091))


## v0.30.0

> Comparing `coralite-v0.29.5` to `HEAD`

**Summary:** 13 commits

### 🐛 Bug Fixes

- improve error messages for invalid custom elements and parsing errors ([041421d](https://codeberg.org/tjdavid/coralite/commit/041421dd4a2c29c660e0c317e288034a0a59e1a2))
- update Coralite instance to use internal handleError ([cb80447](https://codeberg.org/tjdavid/coralite/commit/cb80447dc32fa959637063405292966f20947c47))
- prevent duplicate task deletion on build error handling ([aa9fa6e](https://codeberg.org/tjdavid/coralite/commit/aa9fa6edaa2b397ee2662963a40da90029455563))
- E2E test flakiness and globalAbortController for declarative components ([15b4e47](https://codeberg.org/tjdavid/coralite/commit/15b4e472ce5cdd4e7e86bb54befc6aacd3ccb066))
- properly lazy-load declarative component dependencies without eager bundling ([b57b7e9](https://codeberg.org/tjdavid/coralite/commit/b57b7e9c0d876991d9ba156b46b30174c6a47257))
- automatically instantiate declarative components inside imperative components shadow DOM ([e506c04](https://codeberg.org/tjdavid/coralite/commit/e506c04dfe61a21ed30e7376243fbdf48d6fe5fe))
- make web component values property private (coralite) ([41706e0](https://codeberg.org/tjdavid/coralite/commit/41706e0785e97ec55ad44d376e5efbbcb2341ecf))

### ⚡ Performance Improvements

- optimize HTML loading and framework initialization ([1ecb3c1](https://codeberg.org/tjdavid/coralite/commit/1ecb3c1e42f97a213349e2f9cae80c42ed0a7500))

### 📚 Documentation

- update documentation for coralite internal handleError method ([2a10ec1](https://codeberg.org/tjdavid/coralite/commit/2a10ec1dba4188f3c1e915842e6c7ca4df098975))

### ♻️ Code Refactoring

- unified structured error and warning handling ([d8b59ce](https://codeberg.org/tjdavid/coralite/commit/d8b59ce88fd196b02b0bee8e878edc43de6d4b21))
- Remove expensive global MutationObserver for component loading ([c611677](https://codeberg.org/tjdavid/coralite/commit/c61167723830c7dc7c6483e0e6229ee3b7ddce29))
- Replace expensive global MutationObserver with eager loading ([2dff272](https://codeberg.org/tjdavid/coralite/commit/2dff27254200ddf7c2c309a8cdd04abb16f2304a))

### 🧹 Chores

- remove trailing newline before return statement in coralite.js ([fc38a47](https://codeberg.org/tjdavid/coralite/commit/fc38a479cfcfe018dac0ea9d51f72468c02f8420))


## v0.29.5

> Comparing `coralite-v0.29.4` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- provide AbortSignal | null to component context (coralite) ([cffbd8c](https://codeberg.org/tjdavid/coralite/commit/cffbd8c515f80c422544bdee146388062271ba37))


## v0.29.4

> Comparing `coralite-v0.29.3` to `HEAD`

**Summary:** 6 commits

### ✨ Features

- implement AbortSignal pattern for web component lifecycle ([9d823e5](https://codeberg.org/tjdavid/coralite/commit/9d823e5e709797ed706e1fac0401d51c17655824))

### 📚 Documentation

- update `AbortSignal` injection and helper currying updates. ([97c8053](https://codeberg.org/tjdavid/coralite/commit/97c8053705749c777bc346a453885512eb84dbec))

### ✅ Tests

- decouples test environment from standard CLI ([3b5c8c5](https://codeberg.org/tjdavid/coralite/commit/3b5c8c5300d3fe69c1e6ddc8d862cd1954bbf020))
- cover signal ([c3b6342](https://codeberg.org/tjdavid/coralite/commit/c3b63428d627c8309e96c013a2b744af54d8548b))

### 🧹 Chores

- remove unused path and module imports in script-manager.js ([9a00f57](https://codeberg.org/tjdavid/coralite/commit/9a00f573638c3bbd6935c4348b4225adcb3bc810))

### 🔨 Other Changes

- efactor: transition web component rendering from regex to AST with dom-serializer ([4b750bf](https://codeberg.org/tjdavid/coralite/commit/4b750bfb07a504ca44a295402c5a135b493bbfdd))


## v0.29.3

> Comparing `coralite-v0.29.2` to `HEAD`

**Summary:** 13 commits

### ✨ Features

- enforce deterministic asset hashing and deduplicate rendering pipeline (coralite) ([8248ae1](https://codeberg.org/tjdavid/coralite/commit/8248ae155bb24d5ff6da8e3e74233ef43010221b))

### 🐛 Bug Fixes

- enable native browser module resolution in esbuild (script-manager) ([92d729c](https://codeberg.org/tjdavid/coralite/commit/92d729c3e6a51f18a6783c2c3da593875254c65e))
- map CLI mode to Coralite environment mode (scripts) ([45cb00a](https://codeberg.org/tjdavid/coralite/commit/45cb00ababa5447de68c9c96bd92a545521816ba))
- migrate node polyfill plugin to active library (script-manager) ([870e876](https://codeberg.org/tjdavid/coralite/commit/870e8769bb7fa012db340ac4e1a8adb6ca5564e2))
- handle node built-in modules during local resolution (script-manager) ([60a0ba9](https://codeberg.org/tjdavid/coralite/commit/60a0ba915c3cbb2c139dbf6a5738b40fab5460e0))
- resolve static assets relative to project root (coralite) ([a522802](https://codeberg.org/tjdavid/coralite/commit/a522802eb6b557d46fc175906e29c6aea9fcf312))
- resolve missing asset chunks on nested pages with absolute base URL and explicit assets/js dir ([3fec2e0](https://codeberg.org/tjdavid/coralite/commit/3fec2e09151d12d5c5e9fe75f44484a08ac0c778))
- explicit module exports (coralite) ([46fd07e](https://codeberg.org/tjdavid/coralite/commit/46fd07efd166c1ba50f5b522056cfe5bbf828275))

### 📚 Documentation

- clarify refs plugin resolution ([509ad88](https://codeberg.org/tjdavid/coralite/commit/509ad88b60cc7e0d12c33d84c18e89fe97122d33))

### 🎨 Styles

- normalize whitespace in node-builtins test fixture ([01e9b62](https://codeberg.org/tjdavid/coralite/commit/01e9b621b16f9441f2620446b5e102a81d937bc2))

### 🧹 Chores

- update asset output paths to .coralite/assets/css and .coralite/assets/js ([2de3966](https://codeberg.org/tjdavid/coralite/commit/2de3966841ba81d421496926794d4deaa270c223))
- remove unused import in coralite.js ([c87772c](https://codeberg.org/tjdavid/coralite/commit/c87772ce25bbdbfbb3d17cfa49c6781548e6ac48))
- add @types/node dependency to coralite package.json ([7974174](https://codeberg.org/tjdavid/coralite/commit/7974174bc3f90d1c16f6e712ff30a4cfef060566))


## v0.29.2

> Comparing `coralite-v0.29.1` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- allow plugin client helpers phase 1 to be async ([4d1c2d5](https://codeberg.org/tjdavid/coralite/commit/4d1c2d550450899f41dc8e6c36e6594285bde571))

### 🧹 Chores

- refactor script manager helpers to support async operations ([25d4883](https://codeberg.org/tjdavid/coralite/commit/25d48833ffaf26e04ac992c2e0393b40be640f1a))
- update llms.txt with critical directives and architectural clarifications ([4a6687b](https://codeberg.org/tjdavid/coralite/commit/4a6687b01e32f93f3da380c1c9431552fdef37ba))


## v0.29.1

> Comparing `coralite-v0.29.0` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- update whitespace in reactive-token-parent test fixture to ensure consistent formatting ([566b68b](https://codeberg.org/tjdavid/coralite/commit/566b68bbc363e5ae44f8db9adb201f54dffdd2f0))
- implement reactive token replacement in imperative web components ([b7bf443](https://codeberg.org/tjdavid/coralite/commit/b7bf44394769b6393b1f62229ff2a5ff6b1e3651))


## v0.29.0

> Comparing `coralite-v0.28.5` to `HEAD`

**Summary:** 10 commits

### ✨ Features

- implement recursive imperative component dependency resolution and bundling ([51d55c4](https://codeberg.org/tjdavid/coralite/commit/51d55c4525dca517a1097b43d37f21b8353925f3))
- update plugin client helpers API to two-phase execution (script-manager) ([0aa9e90](https://codeberg.org/tjdavid/coralite/commit/0aa9e901648edcb507b056890c5aeeaf99eb1857))
- add E2E tests for imperative component hydration and shared state ([edbdaff](https://codeberg.org/tjdavid/coralite/commit/edbdaff019b77874a12ba9ea0809369f5fb70699))

### 🐛 Bug Fixes

- add missing newline in script-manager.js context assignment to ensure proper code formatting ([476db43](https://codeberg.org/tjdavid/coralite/commit/476db434de6e5545c6aaee749b95ac4513a131e7))

### 📚 Documentation

- update llms.txt with latest framework changes ([f767914](https://codeberg.org/tjdavid/coralite/commit/f7679143f4970b275ab90fe63307d35bf52f981f))

### ♻️ Code Refactoring

- preserve ref attribute uniqueness instead of relying on id ([4f01629](https://codeberg.org/tjdavid/coralite/commit/4f01629873fe60d5e9d7615e7f13bcab38d306e0))
- completely remove standalone components feature (coralite) ([142d9aa](https://codeberg.org/tjdavid/coralite/commit/142d9aae1be9527febd47b384a7768228c0cdc7f))
- rename Document types to Component globally ([7a5db39](https://codeberg.org/tjdavid/coralite/commit/7a5db399a8589e774dcb9b233595d583bb3b9440))

### ✅ Tests

- update ScriptManager test cases to use new object-based API signature ([ecb96e7](https://codeberg.org/tjdavid/coralite/commit/ecb96e771108397c06824671fb66dd4a71615d41))

### 🧹 Chores

- remove unused tests ([dd988a7](https://codeberg.org/tjdavid/coralite/commit/dd988a7773410436c9e3ece9f7c03119707747c2))


## v0.28.5

> Comparing `coralite-v0.28.4` to `HEAD`

**Summary:** 2 commits

### 📚 Documentation

- enhance Static Assets Plugin documentation with local path support and WASM details ([96d7726](https://codeberg.org/tjdavid/coralite/commit/96d7726977584b4491302e7876ce476e053706c8))

### 🔨 Other Changes

- revert(feat (build)): disable tree shaking in script manager compilation ([d5ec771](https://codeberg.org/tjdavid/coralite/commit/d5ec771bd1111d586596a4aaae217274bc31c3b6))


## v0.28.4

> Comparing `coralite-v0.28.3` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- update staticAssetPlugin to support explicit src and fallback resolution ([55cb5be](https://codeberg.org/tjdavid/coralite/commit/55cb5be34420d16436d7cede264cd5a3170d1a41))


## v0.28.3

> Comparing `coralite-v0.28.2` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- add --assets option to copy static files during build (build) ([bd166da](https://codeberg.org/tjdavid/coralite/commit/bd166da7b194074a4ad1f7d3bbec3c2e98407cbb))
- add static asset plugin support for copying package assets during build (core) ([cab4a3e](https://codeberg.org/tjdavid/coralite/commit/cab4a3e6bad6a53ab03ab7de4c005ee0ee7cd8ec))

### 📚 Documentation

- add JSDoc comments to static asset plugin function ([634c628](https://codeberg.org/tjdavid/coralite/commit/634c628861f5a0fd5b1d9f9d14b8a9977667f45b))

### ♻️ Code Refactoring

- asset parsing to support flexible package:path:dest format ([4623f1c](https://codeberg.org/tjdavid/coralite/commit/4623f1c80eba34c83df915f27ddc2bfb38e3986d))

### ✅ Tests

- add e2e coverage for staticAssetPlugin (coralite) ([5cf9b1b](https://codeberg.org/tjdavid/coralite/commit/5cf9b1bb14b803640df785e77b8be3d046e4a6b8))


## v0.28.2

> Comparing `coralite-v0.28.1` to `HEAD`

**Summary:** 10 commits

### ✨ Features

- implement staticAssetPlugin for handling binary dependencies ([ebc09d4](https://codeberg.org/tjdavid/coralite/commit/ebc09d4d20e3b92d1e199d9b99f7d0007b61aefb))

### 📚 Documentation

- clarify dynamic component data passing and ref compilation patterns ([ca461ef](https://codeberg.org/tjdavid/coralite/commit/ca461ef53fbc3f2a190ae3bbf02da16aec479ee6))
- document Refs Plugin DOM output and testing patterns ([af9e917](https://codeberg.org/tjdavid/coralite/commit/af9e9172f6326fd32f475b345dc104d2ba091d00))
- fix newline ([da73885](https://codeberg.org/tjdavid/coralite/commit/da7388598d23c843cf939eb05e6c5aac6c55567a))
- clarify cross-component import rules for llms.txt ([09d336f](https://codeberg.org/tjdavid/coralite/commit/09d336fb81ddee572578d2deff50703c735f7232))
- add comprehensive LLM documentation for Coralite framework architecture ([31d04aa](https://codeberg.org/tjdavid/coralite/commit/31d04aaa5b4de31bf0da7f1f8ec9f55828596b64))
- clarify client-side execution context in module definitions and types ([cdb228f](https://codeberg.org/tjdavid/coralite/commit/cdb228fbd323d9cf70410ecb4adf054845e65f5f))

### ♻️ Code Refactoring

- make coralite save method use internal options ([8eda84c](https://codeberg.org/tjdavid/coralite/commit/8eda84cc2063d94465a496dd61a8351b108eb95c))
- rename llm.md to llms.txt ([f73641f](https://codeberg.org/tjdavid/coralite/commit/f73641f0c7b4172b7ba625d4c2697c276352be85))

### 🧹 Chores

- document Static Assets Plugin for binary dependencies in llms.txt ([77abc7f](https://codeberg.org/tjdavid/coralite/commit/77abc7f75fa86530ba77d5bccc62c95198815313))


## v0.28.1

> Comparing `coralite-v0.28.0` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- correctly resolve relative path for standalone component imports (script-manager) ([a7f4875](https://codeberg.org/tjdavid/coralite/commit/a7f4875b89e2b7c1b5badc59a6ca23ddd1ec87c7))


## v0.28.0

> Comparing `coralite-v0.27.0` to `HEAD`

**Summary:** 11 commits

### ✨ Features

- implement dynamic attribute binding and token replacement in generated web components ([4a4d22f](https://codeberg.org/tjdavid/coralite/commit/4a4d22f20bfff90698b97a1a742c5768774f4353))
- refactor standalone component tests to use dynamic HTML injection ([19a3523](https://codeberg.org/tjdavid/coralite/commit/19a35234667e960baf66b77ac3380ca2f1a30441))
- expand E2E coverage for standalone Web Components (tests) ([f53ec32](https://codeberg.org/tjdavid/coralite/commit/f53ec320074f485dc8ff45965f9de1340649516b))

### 🐛 Bug Fixes

- update test assertions to match esbuild's JSON key formatting in pluginImports output ([16f51fd](https://codeberg.org/tjdavid/coralite/commit/16f51fd5e15121f0556e355003f25ffd9bd87362))
- update component import specifier in standalone-wrapper fixture (tests) ([f80391a](https://codeberg.org/tjdavid/coralite/commit/f80391a4198ebaf78d5d3340eefad75c8087fc70))
- unconditionally build standalone components with .js extension ([236cead](https://codeberg.org/tjdavid/coralite/commit/236cead5ec79192ca305222f9138910b7806696f))

### 📚 Documentation

- clarify terminology in Coralite README from templates to components ([8b8f31b](https://codeberg.org/tjdavid/coralite/commit/8b8f31b3f3438a87fbd934baedbd30da02f57d5f))
- simplify CLI installation and update option names ([4474b84](https://codeberg.org/tjdavid/coralite/commit/4474b8438c808252f11d410464b21bde3eb02062))

### ♻️ Code Refactoring

- standardise JavaScript formatting and remove trailing whitespace ([d2f36e9](https://codeberg.org/tjdavid/coralite/commit/d2f36e97dac5f6fb0d6da87f0c76eaf165b34553))
- rename `relDir` to `relativeDir` for consistency in coralite.js ([51cb2e2](https://codeberg.org/tjdavid/coralite/commit/51cb2e2959b4a1cd70c650758e65654cfdc0decd))
- improve standalone component E2E tests and assertions ([0241ab9](https://codeberg.org/tjdavid/coralite/commit/0241ab9fd98fe64290855cc28376abca9129340c))


## v0.27.0

> Comparing `coralite-v0.26.0` to `HEAD`

**Summary:** 19 commits

### ✨ Features

- allow `skipRenderByAttribute` and `ignoreByAttribute` to accept string or object arrays ([a9686cd](https://codeberg.org/tjdavid/coralite/commit/a9686cdb877e685c6099e642744b68789b5ede12))
- fix standalone web components client-side import resolution ([df4e3fe](https://codeberg.org/tjdavid/coralite/commit/df4e3fe0505c45b31e6dc975dc39e2975e147cef))
- extract client.imports from AST for standalone component generation ([ccf64f1](https://codeberg.org/tjdavid/coralite/commit/ccf64f1cbcbe0c9dbbac57739fba733e26eabee5))
- bypass transformCSS and remove mock DOM ([022a762](https://codeberg.org/tjdavid/coralite/commit/022a762c9306535cc02a96210c1a5970e86b3a5e))
- add E2E tests for standalone web components and custom elements (tests) ([20ebcfd](https://codeberg.org/tjdavid/coralite/commit/20ebcfd097f9967fe467290bb6e9bf285a3f551c))
- add rudimentary text token replacement for user script payloads ([5d00e07](https://codeberg.org/tjdavid/coralite/commit/5d00e074e33601f0eaa5922938edfcbcd229f811))
- add optional callback transformation for standalone component generation ([443057f](https://codeberg.org/tjdavid/coralite/commit/443057ff70f198aae8a7ed9850b6c2fa1245e655))
- normalize standalone output parameter in constructor (coralite) ([0a40abf](https://codeberg.org/tjdavid/coralite/commit/0a40abf2f843944191d9943a3d6fc2114881757e))
- add --standalone option for client-side web component output directory ([fc761a3](https://codeberg.org/tjdavid/coralite/commit/fc761a3a9ee19dbbec76934a9a9708f6741c9236))
- extract and set $lang from html lang attribute in head (metadata) ([cdaefcd](https://codeberg.org/tjdavid/coralite/commit/cdaefcd291a2c7f9ea544af3b1b759dcb9a56baf))

### 🐛 Bug Fixes

- standalone components not firing e2e tests. ([b52bc5f](https://codeberg.org/tjdavid/coralite/commit/b52bc5f0efb4ef5eeb1a9fb75a0a4565efb07297))
- standalone Web Components so that CSS is unscoped correctly ([9c9c9c5](https://codeberg.org/tjdavid/coralite/commit/9c9c9c5d1738078f4bf6743721adbdc111cf982f))

### 🎨 Styles

- expands abbreviated variable names ([0e644c4](https://codeberg.org/tjdavid/coralite/commit/0e644c45ea437eb8f81df0785e793822512707d4))

### ♻️ Code Refactoring

- move fixture templates to components dir ([70103cc](https://codeberg.org/tjdavid/coralite/commit/70103cc98145aab641f695264fe204b0c43ebe67))
- the refs plugin to assign ref values directly to the `id` ([4271556](https://codeberg.org/tjdavid/coralite/commit/427155649cdab380aba61e37e35085f080ca4893))

### ✅ Tests

- test for current-language support (meta) ([830b337](https://codeberg.org/tjdavid/coralite/commit/830b337cd816d0edca0112574b96e1fb3ec83c9a))

### 🧹 Chores

- update coralite build-html script with standalone and skip-render flags ([a737532](https://codeberg.org/tjdavid/coralite/commit/a737532bb08493c3a3f97fe9c5a0d454e931b016))

### 💥 Breaking Changes

- rename "templates" to "components" across the public API ([8ea8764](https://codeberg.org/tjdavid/coralite/commit/8ea876488a8e5a88d7c8edee1dbc42d30d76ab7b))

### 🔨 Other Changes

- feat!(coralite): implement standalone client-side components with breaking API changes ([533ea3d](https://codeberg.org/tjdavid/coralite/commit/533ea3dae4f1d7a6cf1fa4a5b1dbdb76bfdc788e))


## v0.26.0

> Comparing `coralite-v0.25.0` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- rename script plugin to client and move setup to frontend bundle (script-manager) ([6f96075](https://codeberg.org/tjdavid/coralite/commit/6f960750d836faadb5df3e2d0e4e2572063eea0c))

### ♻️ Code Refactoring

- migrate from script to client config (test-script-plugin) ([aef12a9](https://codeberg.org/tjdavid/coralite/commit/aef12a9097bf95b19d361c419d72a7c6ff9924cb))
- rename IgnoreByAttribute type to Attribute ([241d91a](https://codeberg.org/tjdavid/coralite/commit/241d91a45a9aa0c848f203b39a29be83cbf9c6e6))


## v0.25.0

> Comparing `coralite-v0.24.0` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- add skipRenderByAttribute option to parse but exclude elements from render ([2a0a91c](https://codeberg.org/tjdavid/coralite/commit/2a0a91c7c3155bf467544c19c75975221b5b0eb3))
- add E2E tests for client and plugin imports with ESM bundler format ([475fbef](https://codeberg.org/tjdavid/coralite/commit/475fbef19015bdbda915edd966eade880f42394a))
- add onBeforePageRender and onBeforeBuild plugin hooks ([c18ddaf](https://codeberg.org/tjdavid/coralite/commit/c18ddafcb66a1ebb4cacc6e36111595c706e4770))

### 🐛 Bug Fixes

- change build format to ESM and exclude HTTP(S) from bundling (script-manager) ([764ba6b](https://codeberg.org/tjdavid/coralite/commit/764ba6ba2f15dba2ac751b1764f489a336ff0f4f))

### ♻️ Code Refactoring

- rename onBuildComplete hook to onAfterBuild ([0ad170f](https://codeberg.org/tjdavid/coralite/commit/0ad170f6f5f1b372222c7af6eea222180949b90a))


## v0.24.0

> Comparing `coralite-v0.23.0` to `HEAD`

**Summary:** 26 commits

### ✨ Features

- add plugin configuration support to script compilation (script-manager) ([f27be00](https://codeberg.org/tjdavid/coralite/commit/f27be000f61eb1ffc533025296f8ee7cc8cfd884))
- add validation for script.config property (plugin) ([eabe015](https://codeberg.org/tjdavid/coralite/commit/eabe0152c05234de864a23cb493e18446bfcddde))
- add namespaceExport support and improve import validation ([dc22603](https://codeberg.org/tjdavid/coralite/commit/dc22603847370652e8e0d659e63fbc5e80a5cfd7))
- add validation for script imports and improve script module handling (plugin) ([879ad33](https://codeberg.org/tjdavid/coralite/commit/879ad3368cf2a3fd317b5c2df820a292863b3e61))
- add benchmark suite for Coralite build modes ([c34a508](https://codeberg.org/tjdavid/coralite/commit/c34a508680ad5eb0b3071fbe80a2b8975685d412))
- add unit test for module resolution in development mode ([af7fbbb](https://codeberg.org/tjdavid/coralite/commit/af7fbbb969534aca29e64b0116d3aa302784b0f7))
- introduce development and production build modes ([02a1b7a](https://codeberg.org/tjdavid/coralite/commit/02a1b7a3f80f3139e69f7fd2bde60e483cafbe10))
- add sourcemap to defineComponent client side script ([394f8e0](https://codeberg.org/tjdavid/coralite/commit/394f8e0358df28fbb14f0a0c9f9f25825c77fa52))
- improve script compilation and add source mapping (script-manager) ([b5aa2de](https://codeberg.org/tjdavid/coralite/commit/b5aa2de0ae8355180e8983648f24735459dcd82b))
- add onBuildComplete hook for build lifecycle events ([f0012fe](https://codeberg.org/tjdavid/coralite/commit/f0012feeb9ae59699acad370ee1f85db5899b7b1))

### 🐛 Bug Fixes

- correct sourcemap test assertions to use proper source index ([5179dd6](https://codeberg.org/tjdavid/coralite/commit/5179dd6c70f1b09fab563dc3a117a10e7a521f6c))
- correct helper iteration and inject imports into context (script-manager) ([d8d1fae](https://codeberg.org/tjdavid/coralite/commit/d8d1faef89cfd147a88a36c9f70f8b74da37ccca))
- add mode option to Coralite initialization in sourcemap tests ([5b1c04f](https://codeberg.org/tjdavid/coralite/commit/5b1c04faacb31c92f5fe9a67e0ce889d1d75fac8))
- resolve dynamic import relative to template file ([1f50dbf](https://codeberg.org/tjdavid/coralite/commit/1f50dbf6b92e8f0fd8d6177fb4361ef4397d806a))
- export core plugins from main entry point ([bd53216](https://codeberg.org/tjdavid/coralite/commit/bd53216099f2f83787176f6e2c4553a037b7e574))
- preserve HTML entities in parsing and rendering ([5298814](https://codeberg.org/tjdavid/coralite/commit/52988142f32374a96249549da83ae02f61ecd95a))
- prevent prototype pollution in storage objects (collection) ([e05418d](https://codeberg.org/tjdavid/coralite/commit/e05418d92da16e7f56a2109f71cbd8dd5e153645))

### 📚 Documentation

- update README with plugin documentation details ([23894a2](https://codeberg.org/tjdavid/coralite/commit/23894a26d5dedf72e68fdd786631c07569417c66))
- refactor: consolidate JSDoc callback descriptions into single line ([1e54cf7](https://codeberg.org/tjdavid/coralite/commit/1e54cf700c170878425f8eb10ebcea1a8ef590fc))

### ♻️ Code Refactoring

- restructure defineComponent API for client/server separation ([7f079f2](https://codeberg.org/tjdavid/coralite/commit/7f079f25c56f2e917d135a915c5d169a815dfa27))
- update test assertions to reflect new scriptModules structure (script-manager) ([02fbf9c](https://codeberg.org/tjdavid/coralite/commit/02fbf9c37a459cf9f0ecaadc8dd867c2b6dd9f84))
- extract script parsing logic into utils ([b5301d8](https://codeberg.org/tjdavid/coralite/commit/b5301d807e974834449bafd187714eb46219715b))

### ✅ Tests

- add e2e test for script plugin configuration ([067ac6a](https://codeberg.org/tjdavid/coralite/commit/067ac6a7c09f04fa1ac35cace701f09e39e76ecd))
- add unit tests for config injection into helper context (script-manager) ([1039c05](https://codeberg.org/tjdavid/coralite/commit/1039c050ac02d90239c8e2ef79f45a31f16a601b))
- add unit tests for script extraction and sourcemap generation ([ddab7b3](https://codeberg.org/tjdavid/coralite/commit/ddab7b3b5ca10a7967e370d50631285d54e78bdc))
- add unit test for source map generation (sourcemap) ([40e0b57](https://codeberg.org/tjdavid/coralite/commit/40e0b570a909f20e6e15f43437892deac5d816a4))


## v0.23.0

> Comparing `coralite-v0.22.1` to `HEAD`

**Summary:** 7 commits

### ✨ Features

- add onAfterPageRender plugin hook ([56f7421](https://codeberg.org/tjdavid/coralite/commit/56f742185dd7ee4a94d7b7a1cdd3d2b620286655))
- normalize slot component attributes to camelCase ([5a3a203](https://codeberg.org/tjdavid/coralite/commit/5a3a203e557612de0cf1d157a8d7607caa732665))

### 🐛 Bug Fixes

- update homepage URL from .io to .dev ([a83c431](https://codeberg.org/tjdavid/coralite/commit/a83c431b3f34dd8c90e2600671a78a1fc05a3ac9))
- pass fully merged results to token functions and processor ([479efef](https://codeberg.org/tjdavid/coralite/commit/479efef995ef764197d898b2ea9dacffdb896519))
- update slot references when cloning nodes ([e7d27c8](https://codeberg.org/tjdavid/coralite/commit/e7d27c8c1a9fca0601fcbab8d5db4d9b62b33812))

### ♻️ Code Refactoring

- reorganize type definitions by domain ([27a76df](https://codeberg.org/tjdavid/coralite/commit/27a76dfab1912e411465849e439f300669da91b8))

### 🔨 Other Changes

- types: add type definitions for Coralite plugin system ([1ff954a](https://codeberg.org/tjdavid/coralite/commit/1ff954a0ca080dd97d900049d30c6ec6cc751bf2))


## v0.22.1

> Comparing `coralite-v0.21.0` to `HEAD`

**Summary:** 22 commits

### ✨ Features

- expose page title to available values (plugins) ([0a71ce4](https://codeberg.org/tjdavid/coralite/commit/0a71ce4cdc44a7b0d4d0230700378e7c862bb663))
- add renderContext parameter to evaluation context ([216d342](https://codeberg.org/tjdavid/coralite/commit/216d3427a4a8f3b9cab3f4dae23b0c81caffc4e0))
- implement scoped style support for components ([0589108](https://codeberg.org/tjdavid/coralite/commit/0589108027a02f28e00e053bb908607bd258e282))
- add options parameter to transform method for serialization control ([11fab18](https://codeberg.org/tjdavid/coralite/commit/11fab182866458cdbbf118192b2848a13e253695))
- expose transform method to context source for plugin rendering ([bb6d4eb](https://codeberg.org/tjdavid/coralite/commit/bb6d4eb7302dae790a773490903829a6748976d9))
- add cloneDocumentInstance utility for safe document mutation ([b414461](https://codeberg.org/tjdavid/coralite/commit/b414461586f06d06bfde3144bb39999e1aa75afe))
- add concurrent rendering support with build-scoped render queues ([2658f96](https://codeberg.org/tjdavid/coralite/commit/2658f9607b3f757c12ce278668b74b255f68bfb3))
- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- switch test browser from Firefox to Chromium (playwright) ([093ba6b](https://codeberg.org/tjdavid/coralite/commit/093ba6b7b7e22d032d9a435aa92b71354a82b7e4))
- add server extension hook to plugin configuration (plugin) ([78ada4a](https://codeberg.org/tjdavid/coralite/commit/78ada4a0c4562575eb5ed5996d8e7ee996cecf38))

### 🐛 Bug Fixes

- add missing contextId to custom element rendering for token values ([c68ff17](https://codeberg.org/tjdavid/coralite/commit/c68ff17781100f3986106ec7b994b19c57f56252))
- pass index to createComponent in processTokenValue (define-component) ([e36b81a](https://codeberg.org/tjdavid/coralite/commit/e36b81ac6cc39fc84d04d1df80421a3a67249684))
- remove unnecessary context binding in plugin evaluation ([4a39fc4](https://codeberg.org/tjdavid/coralite/commit/4a39fc4baa4110005ee2da93468ee2363c72648e))
- expose pages collection to plugins during initialization ([a396920](https://codeberg.org/tjdavid/coralite/commit/a396920dc3b572516ed5e0c7bf63b2cfe5d0b19b))

### ♻️ Code Refactoring

- revise defineComponent tests to improve coverage and clarity ([135a2b1](https://codeberg.org/tjdavid/coralite/commit/135a2b1fa7071867e75b07ab0950f3ea9329142f))
- unify component style system and add automatic CSS transformation ([760cf8e](https://codeberg.org/tjdavid/coralite/commit/760cf8e1883f9d67210aee3e40eb80a1e599d9dc))
- rename locals parameter to values in _generatePages ([347037e](https://codeberg.org/tjdavid/coralite/commit/347037ee65871e13b7ed9695270afd78d706709e))
- optimize context handling and plugin binding ([051b201](https://codeberg.org/tjdavid/coralite/commit/051b201557216c666ef4708560c2a3356ed50710))

### ✅ Tests

- remove e2e tests for styles since unit covers it ([b54cdb8](https://codeberg.org/tjdavid/coralite/commit/b54cdb8575252888a62036555406f6796c3e5145))

### 🧹 Chores

- remove publishConfig from package.json files ([180e5f5](https://codeberg.org/tjdavid/coralite/commit/180e5f524e976547fec51f0128f7688c96d5df4d))
- remove old changelog and update plugin configuration ([c051b72](https://codeberg.org/tjdavid/coralite/commit/c051b720adb08a2d4ff5e0fd466443ea94b0cf3f))

### 🔨 Other Changes

- release(coralite): version 0.22.0 ([84a8ffa](https://codeberg.org/tjdavid/coralite/commit/84a8ffa147fbc61cf44c9e36db8aa11cef6c4690))


## v0.22.0

> Comparing `coralite-v0.20.1` to `HEAD`

**Summary:** 28 commits

### ✨ Features

- expose page title to available values (plugins) ([0a71ce4](https://codeberg.org/tjdavid/coralite/commit/0a71ce4cdc44a7b0d4d0230700378e7c862bb663))
- add renderContext parameter to evaluation context ([216d342](https://codeberg.org/tjdavid/coralite/commit/216d3427a4a8f3b9cab3f4dae23b0c81caffc4e0))
- implement scoped style support for components ([0589108](https://codeberg.org/tjdavid/coralite/commit/0589108027a02f28e00e053bb908607bd258e282))
- add options parameter to transform method for serialization control ([11fab18](https://codeberg.org/tjdavid/coralite/commit/11fab182866458cdbbf118192b2848a13e253695))
- expose transform method to context source for plugin rendering ([bb6d4eb](https://codeberg.org/tjdavid/coralite/commit/bb6d4eb7302dae790a773490903829a6748976d9))
- add cloneDocumentInstance utility for safe document mutation ([b414461](https://codeberg.org/tjdavid/coralite/commit/b414461586f06d06bfde3144bb39999e1aa75afe))
- add concurrent rendering support with build-scoped render queues ([2658f96](https://codeberg.org/tjdavid/coralite/commit/2658f9607b3f757c12ce278668b74b255f68bfb3))
- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- switch test browser from Firefox to Chromium (playwright) ([093ba6b](https://codeberg.org/tjdavid/coralite/commit/093ba6b7b7e22d032d9a435aa92b71354a82b7e4))
- add server extension hook to plugin configuration (plugin) ([78ada4a](https://codeberg.org/tjdavid/coralite/commit/78ada4a0c4562575eb5ed5996d8e7ee996cecf38))
- add DOM creation benchmark showing 22x speedup (benchmarks) ([29bb1c5](https://codeberg.org/tjdavid/coralite/commit/29bb1c58203f9a97e5d8327c53b65f9bc7922fff))
- add async performance test (benchmarks) ([4f25b63](https://codeberg.org/tjdavid/coralite/commit/4f25b634a114f94a107ef72ec6ed46db5f76cc9c))

### 🐛 Bug Fixes

- remove unnecessary context binding in plugin evaluation ([4a39fc4](https://codeberg.org/tjdavid/coralite/commit/4a39fc4baa4110005ee2da93468ee2363c72648e))
- expose pages collection to plugins during initialization ([a396920](https://codeberg.org/tjdavid/coralite/commit/a396920dc3b572516ed5e0c7bf63b2cfe5d0b19b))
- use Object.entries instead of Object.values in cleanKeys ([6290c33](https://codeberg.org/tjdavid/coralite/commit/6290c33ab85889ddc0343f472b0ee48c9682ca39))
- rename local constructors to avoid shadowing imported types ([62fc468](https://codeberg.org/tjdavid/coralite/commit/62fc4683aee896654450590ccf272cb40768d879))
- return build results unconditionally ([7c3df81](https://codeberg.org/tjdavid/coralite/commit/7c3df81b043252ffd0e637e3701cb2b4cbcabca0))

### ⚡ Performance Improvements

- optimize findAttributesToIgnore with Map lookup ([22c1fcf](https://codeberg.org/tjdavid/coralite/commit/22c1fcf897206c4abc8ef2b839fcdc5783b76b82))
- replace Object.defineProperties per node with shared prototypes (dom) ([cf243d7](https://codeberg.org/tjdavid/coralite/commit/cf243d75498f77fcf0b6decb582ead0535474ac1))
- optimize compileAllInstances string building (script-manager) ([6286295](https://codeberg.org/tjdavid/coralite/commit/6286295d010c63080752ebaf71936790d2cf720c))

### ♻️ Code Refactoring

- unify component style system and add automatic CSS transformation ([760cf8e](https://codeberg.org/tjdavid/coralite/commit/760cf8e1883f9d67210aee3e40eb80a1e599d9dc))
- rename locals parameter to values in _generatePages ([347037e](https://codeberg.org/tjdavid/coralite/commit/347037ee65871e13b7ed9695270afd78d706709e))
- optimize context handling and plugin binding ([051b201](https://codeberg.org/tjdavid/coralite/commit/051b201557216c666ef4708560c2a3356ed50710))
- update JSDoc types to use Record type ([7c36e07](https://codeberg.org/tjdavid/coralite/commit/7c36e0731b426984f4a510e1a87a95edf33cf7ec))
- optimize cleanKeys function for single-pass efficiency ([032208f](https://codeberg.org/tjdavid/coralite/commit/032208f11b4cf6077b18b2cacb8ccd600b7a67b2))
- hoist kebab-to-camel regex to module scope ([69ed091](https://codeberg.org/tjdavid/coralite/commit/69ed091c635aefb61a406e01ee3b351e960c2a56))

### ✅ Tests

- remove e2e tests for styles since unit covers it ([b54cdb8](https://codeberg.org/tjdavid/coralite/commit/b54cdb8575252888a62036555406f6796c3e5145))

### 🔨 Other Changes

- release(coralite): version 0.21.0 ([949d15f](https://codeberg.org/tjdavid/coralite/commit/949d15fed04e01c06dd89d37aa8953f63c5e899d))

