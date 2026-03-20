export function generateWebComponentClass (componentId, htmlPayload, cssPayload, scriptContent) {
  const parts = []

  // Include cleanKeys utility inline
  parts.push(`
function kebabToCamel(str) {
  return str.replace(/[-|:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase();
  });
}
function cleanKeys(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    result[key] = value;
    const camelKey = kebabToCamel(key);
    if (camelKey !== key) {
      result[camelKey] = value;
    }
  }
  return result;
}
`)

  // Constructable Stylesheets
  if (cssPayload) {
    parts.push(`
const sheet = new CSSStyleSheet();
sheet.replaceSync(\`${cssPayload.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
`)
  }

  // Define component setup and script
  const setupToInject = scriptContent && scriptContent.setupContent ? scriptContent.setupContent : null
  let cleanSetup = setupToInject

  if (cleanSetup) {
    if (cleanSetup.startsWith('function setup(')) {
      cleanSetup = cleanSetup.replace(/^function setup\(/, 'function(')
    } else if (cleanSetup.startsWith('async function setup(')) {
      cleanSetup = cleanSetup.replace(/^async function setup\(/, 'async function(')
    } else if (cleanSetup.startsWith('export default ')) {
      cleanSetup = cleanSetup.replace(/^export default /, '')
    }
  }

  const scriptToInject = scriptContent && scriptContent.content ? scriptContent.content : 'export default function(){}'
  let cleanScript = scriptToInject
  if (cleanScript.startsWith('function script(')) {
    cleanScript = cleanScript.replace(/^function script\(/, 'function(')
  } else if (cleanScript.startsWith('async function script(')) {
    cleanScript = cleanScript.replace(/^async function script\(/, 'async function(')
  } else if (cleanScript.startsWith('export default ')) {
    cleanScript = cleanScript.replace(/^export default /, '')
  }

  parts.push(`
  const componentSetup = ${cleanSetup ? cleanSetup : 'null'};

  const userComponentFn = (() => {
    let defaultExport;
    const module = { get exports() { return defaultExport; }, set exports(v) { defaultExport = v; } };
    module.exports = ${cleanScript};
    return defaultExport;
  })();
  `)

  // Web Component Class Definition
  parts.push(`
class ${componentId.replace(/[-.:]/g, '_')} extends HTMLElement {
  static get observedAttributes() {
    return ${JSON.stringify(scriptContent?.tokens || [])};
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
    this._updateQueued = false;
    ${cssPayload ? `this.shadowRoot.adoptedStyleSheets = [sheet];` : ''}
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (this._context && this._context.values) {
        this._context.values[name] = newValue;
      }
    }
  }

  updateDOM() {
    this._updateQueued = false;
    if (!this.shadowRoot) return;
    
    // Find text nodes that contain the token mapping
    const walker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_TEXT, null, false);
    let node;
    
    while ((node = walker.nextNode())) {
      if (node._coraliteTokens && node._coraliteTokens.length > 0) {
        let newText = node._coraliteOriginalText;
        for (const token of node._coraliteTokens) {
           newText = newText.split(\`{{ \${token} }}\`).join(this._context.values[token] !== undefined ? this._context.values[token] : '');
        }
        node.nodeValue = newText;
      }
    }
    
    // Also update attributes that might have bindings
    const elements = this.shadowRoot.querySelectorAll('*');
    for (const el of elements) {
      if (el._coraliteAttrs) {
        for (const [attrName, originalValue] of Object.entries(el._coraliteAttrs)) {
          let newAttrValue = originalValue;
          const tokenMatches = originalValue.match(/\\{\\{([^}]+)\\}\\}/g) || [];
          for (const match of tokenMatches) {
             const tokenKey = match.replace(/\\{|\\}/g, '').trim();
             newAttrValue = newAttrValue.split(match).join(this._context.values[tokenKey] !== undefined ? this._context.values[tokenKey] : '');
          }
          if (el.getAttribute(attrName) !== newAttrValue) {
            el.setAttribute(attrName, newAttrValue);
          }
        }
      }
    }
  }

  async connectedCallback() {
    const domAttributes = {};
    for (let i = 0; i < this.attributes.length; i++) {
      const attribute = this.attributes[i];
      domAttributes[attribute.name] = attribute.value;
    }
    const initialValues = cleanKeys(domAttributes);

    // Context setup
    this._context = {
      instanceId: this.id || Math.random().toString(36).substr(2, 9),
      componentId: "${componentId}",
      values: {},
      root: this.shadowRoot,
      imports: componentImports,
      document: this.shadowRoot
    };

    const self = this;
    const proxyHandler = {
      set(target, property, value) {
        target[property] = value;
        if (!self._updateQueued) {
          self._updateQueued = true;
          Promise.resolve().then(() => self.updateDOM());
        }
        return true;
      }
    };

    this._context.values = new Proxy(initialValues, proxyHandler);
    const context = this._context;

    // Phase 1 Setup Consumption
    if (registry && registry.globalSetupPromise) {
      const setupValues = await registry.globalSetupPromise;
      for (const [key, value] of Object.entries(setupValues)) {
         context.values[key] = value;
      }
    }

    if (componentSetup) {
      const componentSetupResult = await componentSetup(context);
      if (componentSetupResult && typeof componentSetupResult === 'object') {
        for (const [key, value] of Object.entries(componentSetupResult)) {
           context.values[key] = value;
        }
      }
    }
    
    // Inject HTML payload
    let htmlPayload = \`${htmlPayload.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    
    this.shadowRoot.innerHTML = htmlPayload;

    // Extract tokens mapped to DOM nodes for reactivity
    const walker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const tokens = (text.match(/\\{\\{([^}]+)\\}\\}/g) || []).map(t => t.replace(/\\{|\\}/g, '').trim());
      
      if (tokens.length > 0) {
        node._coraliteTokens = tokens;
        node._coraliteOriginalText = text;
        
        let newText = text;
        for (const token of tokens) {
          newText = newText.split(\`{{ \${token} }}\`).join(context.values[token] !== undefined ? context.values[token] : '');
        }
        node.nodeValue = newText;
      }
    }
    
    // Attribute reactivity
    const allElements = this.shadowRoot.querySelectorAll('*');
    for (const el of allElements) {
      for (const attr of el.attributes) {
         if (attr.value.includes('{{')) {
             if (!el._coraliteAttrs) el._coraliteAttrs = {};
             el._coraliteAttrs[attr.name] = attr.value;
             
             let newAttrValue = attr.value;
             const tokens = (attr.value.match(/\\{\\{([^}]+)\\}\\}/g) || []).map(t => t.replace(/\\{|\\}/g, '').trim());
             for (const token of tokens) {
               newAttrValue = newAttrValue.split(\`{{ \${token} }}\`).join(context.values[token] !== undefined ? context.values[token] : '');
             }
             el.setAttribute(attr.name, newAttrValue);
         }
      }
    }

    // Post-render ref extraction
    const refElements = this.shadowRoot.querySelectorAll('[ref]');
    refElements.forEach(el => {
      const refName = el.getAttribute('ref');
      // Set an ID dynamically if one doesn't exist to match SSR behavior
      const elId = el.id || \`${componentId}__\${refName}-\${Math.random().toString(36).substr(2, 5)}\`;
      el.id = elId;
      context.values[\`ref_\${refName}\`] = elId;
    });

    // Phase 2 Helper Binding
    context.helpers = {};
    if (registry && registry.globalHelperFactories) {
      for (const [key, factory] of Object.entries(registry.globalHelperFactories)) {
        if (typeof factory === 'function') {
           const localHelper = factory(context);
           context.helpers[key] = localHelper;
        } else {
           context.helpers[key] = factory;
        }
      }
    }

    if (typeof userComponentFn === 'function') {
      if (this._initialized) {
        return;
      }
      this._initialized = true;
      await userComponentFn.call(this, context);
    }
  }
}
customElements.define("${componentId}", ${componentId.replace(/[-.:]/g, '_')});
  `)

  return parts.join('\n')
}
