# Changelog

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

