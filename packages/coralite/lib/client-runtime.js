/**
 * @import { InstanceContext } from '../types/index.js'
 */

/**
 * Generates the client-side runtime script for Coralite pages.
 *
 * @param {Object} options
 * @param {string} options.base - The base URL for assets.
 * @param {string} options.sharedChunkPath - The filename of the shared chunk.
 * @param {Object} options.chunkManifest - Manifest mapping component IDs to their chunk filenames.
 * @param {Object.<string, InstanceContext>} options.instances - Map of instance data.
 * @param {string} options.mode - Build mode ('development' or 'production').
 * @param {Object} [options.renderContext] - Build-time render context.
 * @returns {string} The generated JavaScript runtime.
 */
export function generateClientRuntime ({
  base,
  sharedChunkPath,
  chunkManifest,
  instances,
  mode,
  renderContext
}) {
  return `
import { getClientContext, getSetups, render, createCoraliteClass } from '${base}assets/js/${sharedChunkPath}';

window.__coralite_get_client_context = getClientContext;
window.__coralite_get_setups = getSetups;
window.__coralite_render = render;

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
          customElements.define(module.default.componentId, createCoraliteClass(module.default, getClientContext));
        }
      }
    })();
    return loadCache[componentId];
  };

  window.__coralite_load_component = loadComponent;

  const componentTags = Object.keys(componentManifest);
  const loadPromises = [];
  for (let i = 0; i < componentTags.length; i++) {
    const tagName = componentTags[i];
    if (tagName.includes('-')) {
      if (document.querySelector(tagName)) {
        loadPromises.push(loadComponent(tagName));
      }
    }
  }

  await Promise.all(loadPromises);

  if (typeof window.__coralite_resolve_ready__ === 'function') {
    window.__coralite_resolve_ready__();
  }
})();
`.trim()
}
