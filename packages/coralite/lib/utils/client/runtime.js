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
 * @param {string} [options.hydrationData='{}'] - Serialized hydration data.
 * @returns {string} The generated JavaScript runtime.
 */
export function generateClientRuntime ({
  base,
  sharedChunkPath,
  chunkManifest,
  declarativeTags = [],
  hydrationData = '{}'
}) {
  return `
import { getClientContext, createCoraliteClass, globalClientHooks } from '${base}assets/js/${sharedChunkPath}';

(async () => {
  const hydrationData = ${hydrationData};
  const declarativeTags = ${JSON.stringify(declarativeTags)};

  const initialElements = Array.from(document.querySelectorAll('[data-cid]'))
    .filter(el => {
      const tagName = el.tagName.toLowerCase();
      const isDeclarative = declarativeTags.includes(tagName);
      const isInitial = el.hasAttribute('data-coralite-initial');

      if (window['__coralite__'] && window['__coralite__'].components && isInitial) {
        const cid = el.getAttribute('data-cid');
        if (cid && !hydrationData[cid]) {
          const error = new Error('Coralite Hydration Mismatch: Component with data-cid "' + cid + '" (' + tagName + ') has no matching server hydration data.');
          if (typeof window['showCoraliteError'] === 'function') {
            window['showCoraliteError'](error);
          } else {
            console.error(error);
            const overlay = document.createElement('div');
            overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.9);color:white;padding:20px;z-index:10000;font-family:monospace;white-space:pre-wrap;overflow:auto;';
            overlay.innerHTML = '<h1>Coralite Hydration Mismatch</h1><p>' + error.message + '</p>';
            document.body.appendChild(overlay);
          }
          throw error;
        }
      }

      return isDeclarative && isInitial;
    });
  if (window.__coralite__ && window.__coralite__.lifecycle) {
    window.__coralite__.lifecycle._start(initialElements.length, declarativeTags.length);
  }
  globalThis.executableScripts = [];
  globalThis.globalAbortController = new AbortController();

  const componentManifest = ${JSON.stringify(chunkManifest)};
  const loadCache = {};

  const loadComponent = (componentId) => {
    const entry = componentManifest[componentId];
    if (!entry) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];

    loadCache[componentId] = (async () => {
      const isDev = typeof entry === 'string' && entry.includes('-runtime');
      const jsPath = typeof entry === 'string' ? entry : entry.js;
      const cssPath = typeof entry === 'object' ? entry.css : null;

      if (cssPath) {
        const fullCssPath = '${base}assets/css/' + cssPath;
        if (!document.querySelector('link[href="' + fullCssPath + '"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fullCssPath;
          document.head.appendChild(link);
        }
      }

      const module = await import('${base}assets/js/' + jsPath);
      if (module.default && module.default.componentId) {
        const id = module.default.componentId;
        if (!customElements.get(id)) {
          if (module.default.styles && !cssPath) {
            const styleId = 'coralite-style-' + id;
            const inlineStyles = document.getElementById('coralite-inline-styles');
            const hasStyleInInline = inlineStyles && inlineStyles.textContent.includes('[data-style-selector="' + id + '"]');

            if (!document.getElementById(styleId) && !hasStyleInInline) {
              const style = document.createElement('style');
              style.id = styleId;
              style.textContent = '[data-style-selector="' + id + '"] {\\n' + module.default.styles + '\\n}';
              document.head.appendChild(style);
            }
          }
          customElements.define(id, createCoraliteClass(module.default, getClientContext, globalClientHooks, hydrationData));
          if (window.__coralite__ && window.__coralite__.lifecycle) window.__coralite__.lifecycle._markDefined(id);
        }
      }
    })();
    return loadCache[componentId];
  };

  const loadPromises = declarativeTags.map(tagName => loadComponent(tagName));
  await Promise.all(loadPromises);

  window.createCoraliteElement = (tag, options) => {
    const el = document.createElement(tag, options);
    if (componentManifest[tag]) {
      loadComponent(tag).then(() => {
        if (el.constructor === HTMLElement || el.constructor === HTMLUnknownElement) {
          if (typeof customElements.upgrade === 'function') {
            customElements.upgrade(el);
          }
        }
      });
    }
    return el;
  };

  const originalCreateElement = document.createElement;
  document.createElement = function (tag, options) {
    const tagName = (typeof tag === 'string') ? tag.toLowerCase() : tag;
    const element = originalCreateElement.call(document, tag, options);
    if (componentManifest[tagName]) {
      loadComponent(tagName).then(() => {
        if (element.constructor === HTMLElement || element.constructor === HTMLUnknownElement) {
          if (typeof customElements.upgrade === 'function') {
            customElements.upgrade(element);
          }
        }
      });
    }
    return element;
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
