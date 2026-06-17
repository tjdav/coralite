/**
 * @import { InstanceContext } from '../types/index.js'
 */

/**
 * Generates the client-side runtime script for Coralite pages.
 *
 * @param {Object} options - The options used to configure the client-side runtime.
 * @param {string} options.base - The base URL for assets.
 * @param {string} options.sharedChunkPath - The filename of the shared chunk.
 * @param {Object} options.chunkManifest - Manifest mapping component IDs to their chunk filenames.
 * @param {string[]} [options.declarativeTags=[]] - The declarative tags used.
 * @returns {string} The generated JavaScript runtime.
 */
export function generateClientRuntime ({
  base,
  sharedChunkPath,
  chunkManifest,
  declarativeTags = []
}) {
  return `
import { getClientContext, createCoraliteClass, globalClientHooks } from '${base}assets/js/${sharedChunkPath}';

(async () => {
  if (!window.__coralite_ready__) {
    window.__coralite_ready__ = new Promise(resolve => { window.__coralite_resolve_ready__ = resolve; });
  }
  globalThis.executableScripts = [];
  globalThis.globalAbortController = new AbortController();

  const componentManifest = ${JSON.stringify(chunkManifest)};
  const loadCache = {};

  const loadComponent = (componentId) => {
    if (!componentManifest[componentId]) return Promise.resolve();
    if (customElements.get(componentId)) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];

    loadCache[componentId] = (async () => {
      const module = await import('${base}assets/js/' + componentManifest[componentId]);
      if (module.default && module.default.componentId) {
        if (!customElements.get(module.default.componentId)) {
          customElements.define(module.default.componentId, createCoraliteClass(module.default, getClientContext, globalClientHooks));
        }
      }
    })();
    return loadCache[componentId];
  };

  const declarativeTags = ${JSON.stringify(declarativeTags)};

  const loadPromises = declarativeTags.map(tagName => loadComponent(tagName));
  await Promise.all(loadPromises);

  if (typeof window.__coralite_resolve_ready__ === 'function') {
    window.__coralite_resolve_ready__();
  }

  window.createCoraliteElement = (tag, options) => {
    if (componentManifest[tag]) {
      loadComponent(tag);
    }
    return document.createElement(tag, options);
  };

  window.processHTML = (html) => {
    if (typeof html !== 'string') return html;
    const matches = html.matchAll(/<([a-zA-Z0-9-]+)/g);
    for (const match of matches) {
      const tag = match[1].toLowerCase();
      if (componentManifest[tag]) {
        loadComponent(tag);
      }
    }
    return html;
  };
})();
`.trim()
}
