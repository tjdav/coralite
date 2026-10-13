import { ancestor as walkAncestorJS } from 'acorn-walk'

function getPropKeyName (propNode) {
  if (!propNode || propNode.type !== 'Property') {
    return null
  }
  if (!propNode.computed) {
    if (propNode.key.type === 'Identifier') {
      return propNode.key.name
    }
    if (propNode.key.type === 'Literal') {
      return String(propNode.key.value)
    }
  } else if (propNode.key.type === 'Literal') {
    return String(propNode.key.value)
  }
  return null
}

/**
 * Applies slots_context_migration codemod to rewrite old slots signatures (nodes, { state }) -> ({ nodes, state }).
 *
 * @param {object} ast - Acorn AST
 * @param {string} scriptContent - Script source string
 * @returns {{ scriptContent: string, fixesApplied: Array<object> }}
 */
export function applySlotsFixes (ast, scriptContent) {
  const replacements = []
  const fixesApplied = []

  walkAncestorJS(ast, {
    CallExpression (node) {
      if (
        node.callee.type === 'Identifier' &&
        (node.callee.name === 'defineComponent' || node.callee.name === 'definePage') &&
        node.arguments.length > 0 &&
        node.arguments[0].type === 'ObjectExpression'
      ) {
        const configObj = node.arguments[0]
        const slotsProp = configObj.properties.find(p => getPropKeyName(p) === 'slots')

        if (slotsProp && slotsProp.type === 'Property' && slotsProp.value.type === 'ObjectExpression') {
          for (const prop of slotsProp.value.properties) {
            if (prop.type !== 'Property') {
              continue
            }
            const fnVal = prop.value
            if (
              fnVal &&
              (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression')
            ) {
              const params = fnVal.params || []
              if (params.length === 2) {
                const p0 = params[0]
                const p1 = params[1]

                if (
                  p0.type === 'Identifier' &&
                  (p0.name === 'nodes' || p0.name === 'content') &&
                  p1.type === 'ObjectPattern' &&
                  p0.range &&
                  p1.range
                ) {
                  const p0Name = p0.name
                  const [p1Start, p1End] = p1.range
                  const inner = scriptContent.slice(p1Start + 1, p1End - 1).trim()

                  let hasP0Key = false
                  for (const innerProp of p1.properties || []) {
                    const k = getPropKeyName(innerProp)
                    if (k === p0Name) {
                      hasP0Key = true
                      break
                    }
                  }

                  let newParamStr = ''
                  if (hasP0Key) {
                    newParamStr = `{ ${inner} }`
                  } else if (inner) {
                    newParamStr = `{ ${p0Name}, ${inner} }`
                  } else {
                    newParamStr = `{ ${p0Name} }`
                  }

                  replacements.push({
                    start: p0.range[0],
                    end: p1.range[1],
                    replacement: newParamStr,
                    description: `Rewrite slots function parameters to destructured context (${newParamStr})`
                  })
                }
              }
            }
          }
        }
      }
    }
  })

  if (replacements.length > 0) {
    replacements.sort((a, b) => b.start - a.start)
    let newScript = scriptContent
    for (const rep of replacements) {
      newScript = newScript.slice(0, rep.start) + rep.replacement + newScript.slice(rep.end)
      fixesApplied.push({
        code: 'CORALITE-E105',
        description: rep.description
      })
    }
    return {
      scriptContent: newScript,
      fixesApplied
    }
  }

  return {
    scriptContent,
    fixesApplied: []
  }
}
