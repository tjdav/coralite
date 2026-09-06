import {
  RESERVED_CONTEXT_KEYS,
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'

/**
 * Pass 3: Attribute schema validation.
 * Validates attribute definitions for reserved key collisions (CORALITE-E104), blocked Array/Object types (CORALITE-E101),
 * required: true vs default mutex (CORALITE-E102), and async validate/transform functions (CORALITE-E103).
 *
 * @param {object} context - ValidationContext instance
 */
export function validateAttributes (context) {
  const {
    configProps,
    definedAttributes,
    attributeLocations,
    diagnostics,
    filePath,
    scriptStartLine,
    sourceCode
  } = context

  const attrProp = configProps.get('attributes')
  if (!attrProp || attrProp.value.type !== 'ObjectExpression') {
    return
  }

  for (const prop of attrProp.value.properties) {
    if (prop.type !== 'Property') {
      continue
    }
    const attrName = getPropKeyName(prop)
    if (!attrName) {
      continue
    }

    definedAttributes.add(attrName)
    attributeLocations.set(attrName, {
      line: prop.loc.start.line + scriptStartLine,
      column: prop.loc.start.column + 1
    })

    // CORALITE-E104: Reserved context key collision
    if (RESERVED_CONTEXT_KEYS.has(attrName)) {
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E104',
        severity: 'error',
        message: `Attribute '${attrName}' collides with reserved slot context key.`,
        filePath,
        line: prop.loc.start.line + scriptStartLine,
        column: prop.loc.start.column + 1,
        sourceCode,
        cause: 'Property collides with reserved slot context keys.',
        fix: {
          description: 'Rename property to avoid collision with reserved slot context'
        }
      }))
    }

    if (prop.value.type === 'ObjectExpression') {
      let hasRequiredTrue = false
      let hasDefaultProp = false
      let defaultPropNode = null

      for (const cfgProp of prop.value.properties) {
        if (cfgProp.type !== 'Property') {
          continue
        }
        const cfgKey = getPropKeyName(cfgProp)

        // CORALITE-E101: Blocked types (Array / Object)
        if (cfgKey === 'type') {
          let typeName = null
          if (cfgProp.value.type === 'Identifier') {
            typeName = cfgProp.value.name
          } else if (cfgProp.value.type === 'Literal') {
            typeName = String(cfgProp.value.value)
          }
          if (typeName === 'Array' || typeName === 'Object') {
            diagnostics.push(createDiagnostic({
              code: 'CORALITE-E101',
              severity: 'error',
              message: `Attribute '${attrName}' defines blocked type '${typeName}'.`,
              filePath,
              line: cfgProp.loc.start.line + scriptStartLine,
              column: cfgProp.loc.start.column + 1,
              sourceCode,
              cause: 'Array and Object types in attributes cause state pollution and serialization boundary leaks.',
              fix: {
                description: `Component attribute '${attrName}' cannot be Array or Object. Move initialization to async server() block.`
              }
            }))
          }
        }

        // CORALITE-E102: Attribute Mutex (required: true & default)
        if (cfgKey === 'required') {
          if (
            (cfgProp.value.type === 'Literal' && (cfgProp.value.value === true || cfgProp.value.value === 'true')) ||
            (cfgProp.value.type === 'Identifier' && cfgProp.value.name === 'true')
          ) {
            hasRequiredTrue = true
          }
        }
        if (cfgKey === 'default') {
          hasDefaultProp = true
          defaultPropNode = cfgProp
        }

        // CORALITE-E103: Async validate or transform
        if (cfgKey === 'validate' || cfgKey === 'transform') {
          const valNode = cfgProp.value
          if (
            valNode &&
            (valNode.type === 'FunctionExpression' || valNode.type === 'ArrowFunctionExpression') &&
            valNode.async
          ) {
            diagnostics.push(createDiagnostic({
              code: 'CORALITE-E103',
              severity: 'error',
              message: `Attribute '${attrName}' specifies an async ${cfgKey} function.`,
              filePath,
              line: cfgProp.loc.start.line + scriptStartLine,
              column: cfgProp.loc.start.column + 1,
              sourceCode,
              cause: 'Attribute transform and validate functions must be strictly synchronous.',
              fix: {
                description: 'Make attribute validate/transform function synchronous'
              }
            }))
          }
        }
      }

      if (hasRequiredTrue && hasDefaultProp) {
        const targetLoc = defaultPropNode ? defaultPropNode.loc : prop.loc
        diagnostics.push(createDiagnostic({
          code: 'CORALITE-E102',
          severity: 'error',
          message: `Attribute '${attrName}' specifies both required: true and a default value.`,
          filePath,
          line: targetLoc.start.line + scriptStartLine,
          column: targetLoc.start.column + 1,
          sourceCode,
          cause: 'Attributes cannot specify both required: true and a default value.',
          fix: {
            action: 'strip_default',
            description: `Remove default value from attribute '${attrName}' when required: true is set`
          }
        }))
      }
    }
  }
}
