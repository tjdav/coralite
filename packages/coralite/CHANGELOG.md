# Changelog

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

