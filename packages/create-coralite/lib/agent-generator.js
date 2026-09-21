import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from '../package.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates', 'agent')

/**
 * Canonical target registry. Order is stable and used for `--target=all`.
 */
export const AGENT_TARGETS = {
  'agents-md': {
    dest: 'AGENTS.md',
    template: 'AGENTS.md'
  },
  cursor: {
    dest: path.join('.cursor', 'rules', 'coralite.mdc'),
    template: 'coralite.mdc'
  },
  claude: {
    dest: 'CLAUDE.md',
    template: 'CLAUDE.md'
  },
  copilot: {
    dest: path.join('.github', 'copilot-instructions.md'),
    template: 'copilot-instructions.md'
  }
}

const ALL_TARGETS = Object.keys(AGENT_TARGETS)

/**
 *
 */
export class AgentTargetError extends Error {
  /**
   *
   */
  constructor (message) {
    super(message)
    this.name = 'AgentTargetError'
  }
}

/**
 * Accepts `undefined` | 'all' | 'cursor' | 'cursor,claude' | string[]
 * Returns a de-duplicated array of valid target keys.
 */
export function normalizeTargets (target) {
  if (target == null || target === '' || target === 'all') {
    return [...ALL_TARGETS]
  }

  const list = Array.isArray(target)
    ? target
    : String(target).split(',').map((s) => s.trim()).filter(Boolean)

  if (list.length === 0) {
    return [...ALL_TARGETS]
  }

  const seen = new Set()
  for (const t of list) {
    if (!AGENT_TARGETS[t]) {
      throw new AgentTargetError(
        `Unknown agent target "${t}". Valid values: all, ${ALL_TARGETS.join(', ')}`
      )
    }
    seen.add(t)
  }
  return [...seen]
}

function interpolate (content, vars) {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), vars)
    return value == null ? match : String(value)
  })
}

/**
 * Scaffold AI assistant rule files into `cwd`.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.cwd]           Target directory (default: process.cwd()).
 * @param {string|string[]} [opts.target] 'all' | 'cursor' | 'cursor,claude' | [...]
 * @param {boolean}  [opts.force]         Overwrite existing files.
 * @param {object}   [opts.vars]          Template interpolation variables.
 * @param {object}   [opts.logger]        Console-like logger (log/warn/error).
 * @returns {{ written: string[], skipped: string[], targets: string[] }}
 */
export function generateAgentRules ({
  cwd = process.cwd(),
  target = 'all',
  force = false,
  vars = {},
  logger = console
} = {}) {
  const targets = normalizeTargets(target)

  const mergedVars = {
    version: pkg.version,
    name: pkg.name,
    ...vars
  }

  const written = []
  const skipped = []

  for (const key of targets) {
    const { dest, template } = AGENT_TARGETS[key]
    const outPath = path.join(cwd, dest)
    const templatePath = path.join(TEMPLATE_DIR, template)

    if (!force && fs.existsSync(outPath)) {
      skipped.push(dest)
      logger.warn?.(`  skip   ${dest}  (already exists — use --force to overwrite)`)
      continue
    }

    const content = interpolate(fs.readFileSync(templatePath, 'utf8'), mergedVars)

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, content)

    written.push(dest)
    logger.log?.(`  create ${dest}`)
  }

  return {
    written,
    skipped,
    targets
  }
}
