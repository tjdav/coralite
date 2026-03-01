# Changelog

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

