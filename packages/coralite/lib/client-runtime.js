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
 * @param {string} options.mode - Build mode ('development' or 'development').
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
  const hydrationData = {}
  for (const instance of Object.values(instances)) {
    const contextId = instance.instanceId
    if (renderContext && renderContext.source && renderContext.source.contextInstances[contextId]) {
      const coraliteContext = renderContext.source.contextInstances[contextId]
      if (coraliteContext.state.__script__ && coraliteContext.state.__script__.data) {
        hydrationData[contextId] = coraliteContext.state.__script__.data
      }
    }
  }

  const declarativeFunctions = Object.values(instances).map(instance => `
  declarativeFunctions.push((async() => {
    const context = {
      instanceId: '${instance.instanceId}',
      componentId: '${instance.componentId}',
      state: ${JSON.stringify(instance.state || {})},
      page: ${JSON.stringify(instance.page || {})},
      signal: globalAbortController.signal
    };
    const setupPropertiesPromise = globalSetupPropertiesPromise;
    const pluginContextsPromise = getClientContext(context);
    const modulePromise = import('${base}assets/js/${chunkManifest[instance.componentId]}');

    const [setupProperties, pluginContexts, module] = await Promise.all([setupPropertiesPromise, pluginContextsPromise, modulePromise]);

    Object.assign(context, pluginContexts);
    const stateTarget = { ...module.default.defaultValues, ...context.state, ...setupProperties };
    context.state = createReactiveProxy(stateTarget, () => {});
    if (context.root === undefined) context.root = null;
    if (context.refs === undefined) context.refs = (id) => null;

    // Explicitly load declarative script dependencies if any
    const deps = module.default.dependencies || [];
    if (deps.length > 0) {
      const loadPromises = deps.map(dep => loadComponent(dep));
      await Promise.all(loadPromises);
    }

    context.imports = module.default.imports || {};

    return async () => {
      if (module.default.script) {
        await module.default.script(context);
      }
    };
  })());
  `).join('\n')

  const executionBlock = mode === 'development'
    ? `
  for (let i = 0; i < executableScripts.length; i++) {
    await executableScripts[i]();
  }
  `
    : `
  const scriptPromises = [];
  for (let i = 0; i < executableScripts.length; i++) {
    scriptPromises.push(executableScripts[i]());
  }
  await Promise.all(scriptPromises);
  `

  return `
import { getClientContext, getSetups, render } from '${base}assets/js/${sharedChunkPath}';

const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
  'truespeed'
]);

function createReactiveProxy(target, onChange, proxies = new WeakMap()) {
  if (proxies.has(target)) return proxies.get(target);
  const handler = {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (value !== null && typeof value === 'object' && !(typeof Node !== 'undefined' && value instanceof Node)) {
        return createReactiveProxy(value, onChange, proxies);
      }
      return value;
    },
    set(target, property, value, receiver) {
      const oldValue = target[property];
      if (oldValue === value && property in target) return true;
      const result = Reflect.set(target, property, value, receiver);
      if (result) onChange({ property, value, oldValue, target });
      return result;
    },
    deleteProperty(target, property) {
      const hadProperty = Object.prototype.hasOwnProperty.call(target, property);
      const oldValue = target[property];
      const result = Reflect.deleteProperty(target, property);
      if (result && hadProperty) onChange({ property, value: undefined, oldValue, target, deleted: true });
      return result;
    }
  };
  const proxy = new Proxy(target, handler);
  proxies.set(target, proxy);
  return proxy;
}

function createReadOnlyProxy(target, proxies = new WeakMap()) {
  if (proxies.has(target)) return proxies.get(target);
  const handler = {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (value !== null && typeof value === 'object' && !(typeof Node !== 'undefined' && value instanceof Node)) {
        return createReadOnlyProxy(value, proxies);
      }
      return value;
    },
    set() { throw new Error('Coralite Error: Cannot mutate state inside a getter. State is read-only here.'); },
    deleteProperty() { throw new Error('Coralite Error: Cannot delete state inside a getter. State is read-only here.'); }
  };
  const proxy = new Proxy(target, handler);
  proxies.set(target, proxy);
  return proxy;
}

function coerce(value, type) {
  if (value === null || value === undefined) return value;
  if (type === Number || type === 'Number') return Number(value);
  if (type === Boolean || type === 'Boolean') return value !== 'false' && value !== null && value !== '';
  if (type === String || type === 'String') return String(value);
  return value;
}

// Global setups initialization
const globalContext = {};
const globalSetupPropertiesPromise = getSetups(globalContext);

(async () => {
  let resolveCoraliteReady;
  window.__coralite_ready__ = new Promise(resolve => resolveCoraliteReady = resolve);
  const pendingHydrations = [];
  const addPendingHydration = (promise) => pendingHydrations.push(promise);
  const componentManifest = ${JSON.stringify(chunkManifest)};
  const loadCache = {};
  const instanceCounters = {};

  const loadComponent = (componentId) => {
    if (!componentManifest[componentId]) return Promise.resolve();
    if (customElements.get(componentId)) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];

    loadCache[componentId] = (async () => {
      // Dynamic import to lazy-load the component chunk
      const module = await import('${base}assets/js/' + componentManifest[componentId]);
      if (module.default && module.default.componentId) {
        if (!customElements.get(module.default.componentId)) {
          class ComponentElement extends HTMLElement {
          constructor() {
            super();
            this.componentId = module.default.componentId;
            this._abortController = null;

            instanceCounters[this.componentId] = instanceCounters[this.componentId] || 0;
            this._index = instanceCounters[this.componentId]++;

            this._instanceId = \`\${this.componentId}-\${this._index}\`;

            this._stateTarget = {};
            this._state = null;
            this._getters = module.default.getters || {};
            this._getterControllers = new Map();

            this._styles = ''
            if (module.default.styles) {
              this._styles += \`<style>[data-style-selector="\${this.componentId}"] {\\n\${module.default.styles}\\n}</style>\`;
            }
          }

          connectedCallback() {
            this._abortController = new AbortController();

            if (!this._lightDomSlotsCaptured) {
              this._lightDomSlotsCaptured = true;
              this._lightDomSlots = {};

              // Capture light DOM children
              const childNodes = Array.from(this.childNodes);

              for (let i = 0; i < childNodes.length; i++) {
                const child = childNodes[i];
                const slotName = (child.getAttribute && child.getAttribute('slot')) || 'default';

                if (!this._lightDomSlots[slotName]) {
                  this._lightDomSlots[slotName] = [];
                }

                this._lightDomSlots[slotName].push(child);

                // Hide the nodes so they don't cause FOUC
                if (child.nodeType === 1) {
                  child.__coralite_orig_display = child.style.display;
                  child.style.display = 'none';
                } else if (child.nodeType === 3) { // TEXT_NODE
                  child.__coralite_orig_text = child.textContent;
                  child.textContent = '';
                }
              }
            }

            // 1. Initialize attributes with defaults
            const attributeSchema = module.default.attributes || {};
            for (const [key, schema] of Object.entries(attributeSchema)) {
              if (schema.default !== undefined) {
                this._stateTarget[key] = schema.default;
              }
            }

            // 2. Extract and coerce attributes from HTML
            const htmlAttributes = this.attributes;
            for (let i = 0; i < htmlAttributes.length; i++) {
              const attr = htmlAttributes[i];
              const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
              let value = attr.value;

              if (attributeSchema[camelName]) {
                value = coerce(value, attributeSchema[camelName].type);
              }

              this._stateTarget[camelName] = value;
              if (camelName !== attr.name) {
                this._stateTarget[attr.name] = value;
              }
            }

            // Merge legacy defaults
            this._stateTarget = Object.assign({}, module.default.defaultValues, this._stateTarget);

            // Hydrate server data
            const hydrationTag = document.getElementById('__CORALITE_HYDRATION__');
            if (hydrationTag) {
              const allHydrationData = JSON.parse(hydrationTag.textContent);
              const instanceHydration = allHydrationData[this._instanceId];
              if (instanceHydration) {
                Object.assign(this._stateTarget, instanceHydration);
              }
            }

            if (module.default.templateValues && module.default.templateValues.refs) {
              for (let i = 0; i < module.default.templateValues.refs.length; i++) {
                const ref = module.default.templateValues.refs[i];
                this._stateTarget['ref_' + ref.name] = this.componentId + '__' + ref.name + '-' + this._index;
              }
            }

            const initPromise = (async () => {
              const deps = module.default.dependencies || [];
              if (deps.length > 0) {
                const loadPromises = deps.map(dep => loadComponent(dep));
                await Promise.all(loadPromises);
              }

              const setupProperties = await globalSetupPropertiesPromise;
              Object.assign(this._stateTarget, setupProperties);

              this._state = createReactiveProxy(this._stateTarget, () => {
                this._evaluateGetters();
                this._render();
              });

              await this._evaluateGetters();
              this._render();

              const localContext = {
                instanceId: this._instanceId,
                componentId: this.componentId,
                state: this._state,
                page: module.default.page || {},
                root: this,
                signal: this._abortController.signal
              };

              const pluginContexts = await getClientContext(localContext);
              Object.assign(localContext, pluginContexts);

              localContext.imports = module.default.imports || {};

              if (module.default.script) {
                // Ensure state is the latest proxy
                localContext.state = this._state;
                await module.default.script(localContext);
              }
            })();
            addPendingHydration(initPromise);

            this._observer = new MutationObserver(async (mutations) => {
              let shouldUpdate = false;
              const attributeSchema = module.default.attributes || {};

              for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                  const attrName = mutation.attributeName;
                  const camelName = attrName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                  let newValue = this.getAttribute(attrName);

                  if (attributeSchema[camelName]) {
                    newValue = coerce(newValue, attributeSchema[camelName].type);
                  }

                  if (this._stateTarget[camelName] !== newValue) {
                    this._state[camelName] = newValue;
                    if (camelName !== attrName) {
                        this._state[attrName] = newValue;
                    }
                    shouldUpdate = true;
                  }
                }
              }
              if (shouldUpdate) {
                await this._evaluateGetters();
                this._render();
              }
            });

            this._observer.observe(this, { attributes: true });
          }

          _replaceTokens(templateAST, templateValues) {
            // Map to store cloned nodes by their _id
            const nodeById = {};

            // Function to deep clone AST and build ID map
            const cloneAST = (nodes) => {
              return nodes.map((node) => {
                const cloned = { ...node };
                if (cloned._id != null) {
                  nodeById[cloned._id] = cloned;
                }
                if (cloned.children) {
                  cloned.children = cloneAST(cloned.children);
                }
                if (cloned.attribs) {
                  cloned.attribs = { ...cloned.attribs };
                }
                return cloned;
              });
            };

            const ast = cloneAST(templateAST);

            if (!templateValues) return ast;

            // Replace tokens in attributes using the exact token matches
            if (templateValues.attributes) {
              for (let i = 0; i < templateValues.attributes.length; i++) {
                const item = templateValues.attributes[i];
                const node = nodeById[item.elementId];
                if (!node || !node.attribs || node.attribs[item.name] == null) continue;

                for (let j = 0; j < item.tokens.length; j++) {
                  const token = item.tokens[j];
                  let value = this._state[token.name];

                  if (typeof value === 'function') {
                    value = value(this._state);
                  }
                  if (value == null) value = '';

                  // Replace exactly the token content string rather than a regex over the whole attribute
                  if (BOOLEAN_ATTRIBUTES.has(item.name) && (node.attribs[item.name] || '').trim() === token.content) {
                    const isFalsy = value === 'false' || value === 'null' || value === 'undefined' || value === '0' || value === 0 || value === '' || value === false || value === null || value === undefined;

                    if (isFalsy) {
                      delete node.attribs[item.name];
                    } else {
                      node.attribs[item.name] = '';
                    }
                  } else {
                    node.attribs[item.name] = node.attribs[item.name].split(token.content).join(value);
                  }
                }
              }
            }

            // Replace tokens in text nodes using the exact token matches
            if (templateValues.textNodes) {
              for (let i = 0; i < templateValues.textNodes.length; i++) {
                const item = templateValues.textNodes[i];
                const node = nodeById[item.textNodeId];
                if (!node || node.data == null) continue;

                for (let j = 0; j < item.tokens.length; j++) {
                  const token = item.tokens[j];
                  let value = this._state[token.name];

                  if (typeof value === 'function') {
                    value = value(this._state);
                  }
                  if (value == null) value = '';

                  node.data = node.data.split(token.content).join(value);
                }
              }
            }

            return ast;
          }

          async _evaluateGetters() {
            const roState = createReadOnlyProxy(this._stateTarget);
            const promises = [];

            for (const [key, getter] of Object.entries(this._getters)) {
              if (this._getterControllers.has(key)) {
                this._getterControllers.get(key).abort();
              }
              const controller = new AbortController();
              this._getterControllers.set(key, controller);

              const result = getter(roState, { signal: controller.signal });
              if (result && typeof result.then === 'function') {
                promises.push((async () => {
                  try {
                    const value = await result;
                    if (!controller.signal.aborted) {
                      this._stateTarget[key] = value;
                      this._render();
                    }
                  } catch (e) {
                    if (!controller.signal.aborted) {
                      if (e && e.name !== 'AbortError' && e.message !== 'AbortError') throw e;
                    }
                  }
                })());
              } else {
                this._stateTarget[key] = result;
              }
            }
            if (promises.length > 0) {
              await Promise.all(promises);
            }
          }

          _render() {
            let content = this._styles;
            const ast = this._replaceTokens(module.default.templateAST, module.default.templateValues);

            if (this._styles) {
              for (let i = 0; i < ast.length; i++) {
                const node = ast[i];
                if (node.type === 'tag') {
                  if (!node.attribs) node.attribs = {};
                  node.attribs['data-style-selector'] = this.componentId;
                }
              }
            }

            content += render(ast, { decodeEntities: false });

            this.innerHTML = content;

            // Handle slots projection
            const slots = this.querySelectorAll('slot');
            for (let i = 0; i < slots.length; i++) {
              const slot = slots[i];
              const slotName = slot.getAttribute('name') || 'default';
              let projectedNodes = this._lightDomSlots[slotName];

              const slotFunction = module.default.defaultValues && module.default.defaultValues['slots_method_' + slotName];

              if (slotFunction && typeof slotFunction === 'function') {
                const computedResult = slotFunction(projectedNodes || [], this._state);
                if (typeof computedResult === 'string') {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = computedResult;
                  projectedNodes = Array.from(tempDiv.childNodes);
                } else if (Array.isArray(computedResult)) {
                  projectedNodes = computedResult;
                }
              }

              if (projectedNodes && projectedNodes.length > 0) {
                // We have content to project, clear the fallback content
                slot.replaceChildren();
                // Append original nodes
                for (let j = 0; j < projectedNodes.length; j++) {
                  // Restore original visibility before re-inserting
                  if (projectedNodes[j].nodeType === 1 && projectedNodes[j].hasOwnProperty('__coralite_orig_display')) {
                    projectedNodes[j].style.display = projectedNodes[j].__coralite_orig_display;
                    delete projectedNodes[j].__coralite_orig_display;
                  } else if (projectedNodes[j].nodeType === 3 && projectedNodes[j].hasOwnProperty('__coralite_orig_text')) {
                    projectedNodes[j].textContent = projectedNodes[j].__coralite_orig_text;
                    delete projectedNodes[j].__coralite_orig_text;
                  }
                  // Re-insert original nodes to preserve their state and event listeners across re-renders
                  slot.parentNode.insertBefore(projectedNodes[j], slot);
                }
                slot.parentNode.removeChild(slot);
              } else {
                // Use fallback content: unwrap the slot tag
                while (slot.firstChild) {
                  slot.parentNode.insertBefore(slot.firstChild, slot);
                }
                slot.parentNode.removeChild(slot);
              }
            }

            const refElements = this.querySelectorAll('[ref]');
            for (let i = 0; i < refElements.length; i++) {
              const element = refElements[i];

              let current = element.parentNode;
              let isNested = false;
              while (current && current !== this) {
                if (current.tagName && current.tagName.includes('-')) {
                  isNested = true;
                  break;
                }
                current = current.parentNode;
              }

              if (isNested) continue;

              const refName = element.getAttribute('ref');

              const dynamicId = \`\${this.componentId}__\${refName}-\${this._index}\`;

              element.setAttribute('ref', dynamicId);

              const previousTestId = element.getAttribute('data-testid')
              if (previousTestId !== null) {
                element.setAttribute('data-testid', dynamicId);
              }

              this._stateTarget[\`ref_\${refName}\`] = dynamicId;
            }
          }

          disconnectedCallback() {
            if (this._abortController) {
              this._abortController.abort();
              this._abortController = null;
            }
            if (this._observer) {
              this._observer.disconnect();
              this._observer = null;
            }
            for (const controller of this._getterControllers.values()) {
              controller.abort();
            }
            this._getterControllers.clear();
          }
        }
        customElements.define(module.default.componentId, ComponentElement);
      }
      }
    })();
    return loadCache[componentId];
  };

  // Define all custom elements present in the dynamically determined chunk manifest
  const componentTags = Object.keys(componentManifest);
  const loadPromises = [];
  for (let i = 0; i < componentTags.length; i++) {
    const tagName = componentTags[i];
    if (tagName.includes('-') && !tagName.endsWith('.js')) {
      const elements = document.querySelectorAll(tagName);
      if (elements.length > 0) {
        loadPromises.push(loadComponent(tagName));
      }
    }
  }

  await Promise.all(loadPromises);

  // Invoke inline declarative instances defined in HTML (legacy support for <script> blocks mapped to _generatePages instances if needed)
  const declarativeFunctions = [];
  ${declarativeFunctions}

  await Promise.all(declarativeFunctions);
  ${executionBlock}
  // Wait for all pending hydrations (including dynamically spawned ones) to complete
  while (pendingHydrations.length > 0) {
    const currentBatch = [...pendingHydrations];
    await Promise.all(currentBatch);
    pendingHydrations.splice(0, currentBatch.length);
  }
  resolveCoraliteReady();
})();
`.trim()
}
