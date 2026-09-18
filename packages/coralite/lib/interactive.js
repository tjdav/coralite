import * as clack from '@clack/prompts'

/**
 * Handle user cancellation of a prompt cleanly.
 *
 * @template T
 * @param {T | symbol} value - Value returned from clack prompt
 * @returns {T} Unwrapped value
 */
function handleCancel (value) {
  if (clack.isCancel(value)) {
    clack.cancel('Operation cancelled.')
    process.exit(0)
  }
  /** @type {T} */
  const result = value
  return result
}

/**
 * Common Coralite diagnostic codes for selection.
 */
const COMMON_ERROR_CODES = [
  {
    value: 'CORALITE-E201',
    label: 'E201 - Inline template expression requiring getter derivation'
  },
  {
    value: 'E102',
    label: 'E102 - Unnecessary default property on required attribute'
  },
  {
    value: 'E105',
    label: 'E105 - Legacy context.attributes reference requiring context.state'
  },
  {
    value: 'E202',
    label: 'E202 - Missing element ref injection'
  },
  {
    value: 'E203',
    label: 'E203 - Direct inline event listener binding'
  },
  {
    value: 'E301',
    label: 'E301 - Top-level static import in client script'
  },
  {
    value: 'E302',
    label: 'E302 - Non-serializable context closure in client script'
  },
  {
    value: 'E303',
    label: 'E303 - Invalid client hook signature'
  },
  {
    value: 'W204',
    label: 'W204 - Unused component state property or getter'
  },
  {
    value: 'P101',
    label: 'P101 - Invalid plugin manifest structure'
  },
  {
    value: 'P201',
    label: 'P201 - Missing two-phase currying in plugin context'
  },
  {
    value: 'P301',
    label: 'P301 - Invalid plugin client lifecycle hook'
  }
]

/**
 * Prompt user for error code filter via stepwise selection.
 *
 * @returns {Promise<string[] | undefined>} Selected error code(s) or undefined
 */
async function promptErrorCodeFilter () {
  const codeChoice = handleCancel(await clack.select({
    message: 'Select error code filter mode:',
    options: [
      {
        value: 'all',
        label: 'All rules (no filter)'
      },
      {
        value: 'select',
        label: 'Select from common error codes'
      },
      {
        value: 'custom',
        label: 'Enter custom error code(s)'
      }
    ]
  }))

  if (codeChoice === 'select') {
    const selectedCodes = handleCancel(await clack.multiselect({
      message: 'Select error codes to filter by:',
      options: COMMON_ERROR_CODES,
      required: true
    }))
    /** @type {string[]} */
    const codesResult = selectedCodes
    return codesResult
  }

  if (codeChoice === 'custom') {
    const customCodes = handleCancel(await clack.text({
      message: 'Enter custom error code(s) (comma-separated, e.g. E201, E105):',
      placeholder: 'E201, E105',
      validate: (input) => {
        if (!input || !input.trim()) {
          return 'Please enter at least one error code.'
        }
      }
    }))
    return customCodes.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean)
  }

  return undefined
}

/**
 * Prompt options for check workflow.
 *
 * @param {Object} [options] - Available options
 * @param {string} [options.cwd] - Current working directory
 * @param {boolean} [options.hasComponents] - Whether components directory exists
 * @param {boolean} [options.hasPages] - Whether pages directory exists
 * @param {boolean} [options.hasPlugins] - Whether plugins directory exists
 * @returns {Promise<Object>} Resolved check configuration options
 */
export async function promptCheckOptions (options = {}) {
  clack.intro('🪸 Coralite Interactive Check Workspace')

  const initialDomains = []
  if (options.hasComponents !== false) {
    initialDomains.push({
      value: 'components',
      label: 'Components',
      hint: 'Validate Coralite components (.html)'
    })
  }
  if (options.hasPages !== false) {
    initialDomains.push({
      value: 'pages',
      label: 'Pages',
      hint: 'Validate Coralite HTML pages'
    })
  }
  if (options.hasPlugins !== false) {
    initialDomains.push({
      value: 'plugins',
      label: 'Plugins',
      hint: 'Validate Coralite plugins'
    })
  }

  if (initialDomains.length === 0) {
    clack.cancel('No valid targets (components, pages, plugins) found in project.')
    process.exit(1)
  }

  const selectedDomains = handleCancel(await clack.multiselect({
    message: 'Select domains to validate:',
    options: initialDomains,
    required: true
  }))

  const selectedErrorCodes = await promptErrorCodeFilter()

  const defaultStatus = selectedErrorCodes && selectedErrorCodes.length > 0 ? 'failed' : 'all'

  const statusChoice = handleCancel(await clack.select({
    message: 'Select status display filter:',
    options: [
      {
        value: 'failed',
        label: 'Only failed / broken files',
        hint: 'Suppress passed VALID files'
      },
      {
        value: 'all',
        label: 'All files',
        hint: 'Show both passed and failed files'
      },
      {
        value: 'passed',
        label: 'Only passed files'
      }
    ],
    initialValue: defaultStatus
  }))

  const extraFlags = handleCancel(await clack.multiselect({
    message: 'Select optional flags:',
    options: [
      {
        value: 'strict',
        label: '--strict',
        hint: 'Fail build if warnings or unused code exist'
      },
      {
        value: 'coverage',
        label: '--coverage',
        hint: 'Include test execution coverage metrics'
      }
    ],
    required: false
  }))

  /** @type {string[]} */
  const flagsList = extraFlags
  const extraSet = new Set(flagsList)

  clack.outro('Configuration complete. Executing check pass...')

  return {
    domains: selectedDomains,
    errorCode: selectedErrorCodes,
    status: statusChoice,
    onlyFailed: statusChoice === 'failed',
    strict: extraSet.has('strict'),
    coverage: extraSet.has('coverage')
  }
}

/**
 * Prompt options for fix workflow.
 *
 * @param {Object} [options] - Available options
 * @param {string} [options.cwd] - Current working directory
 * @param {boolean} [options.hasComponents] - Whether components directory exists
 * @param {boolean} [options.hasPlugins] - Whether plugins directory exists
 * @returns {Promise<Object>} Resolved fix configuration options
 */
export async function promptFixOptions (options = {}) {
  clack.intro('🪸 Coralite Interactive Fix Workspace')

  const initialDomains = []
  if (options.hasComponents !== false) {
    initialDomains.push({
      value: 'components',
      label: 'Components',
      hint: 'Auto-fix Coralite components'
    })
  }
  if (options.hasPlugins !== false) {
    initialDomains.push({
      value: 'plugins',
      label: 'Plugins',
      hint: 'Auto-fix Coralite plugins'
    })
  }

  if (initialDomains.length === 0) {
    clack.cancel('No fixable targets (components, plugins) found in project.')
    process.exit(1)
  }

  const selectedDomains = handleCancel(await clack.multiselect({
    message: 'Select domains to fix:',
    options: initialDomains,
    required: true
  }))

  const fixMode = handleCancel(await clack.select({
    message: 'Select fix execution mode:',
    options: [
      {
        value: 'apply',
        label: 'Apply fixes directly to disk',
        hint: 'Modify files on disk'
      },
      {
        value: 'dry-run',
        label: 'Preview changes (--dry-run)',
        hint: 'Display colorized diffs without writing'
      }
    ]
  }))

  const selectedErrorCodes = await promptErrorCodeFilter()

  const statusChoice = handleCancel(await clack.select({
    message: 'Select post-fix report status filter:',
    options: [
      {
        value: 'failed',
        label: 'Only failed / broken files',
        hint: 'Suppress passed VALID files'
      },
      {
        value: 'all',
        label: 'All files',
        hint: 'Show both passed and failed files'
      }
    ],
    initialValue: selectedErrorCodes && selectedErrorCodes.length > 0 ? 'failed' : 'all'
  }))

  clack.outro('Configuration complete. Running auto-fix pass...')

  return {
    domains: selectedDomains,
    dryRun: fixMode === 'dry-run',
    errorCode: selectedErrorCodes,
    status: statusChoice,
    onlyFailed: statusChoice === 'failed'
  }
}

/**
 * Prompt options for single domain validation commands (validate-components, validate-pages, validate-plugins).
 *
 * @param {string} domain - Domain name ('components', 'pages', 'plugins')
 * @param {Object} [options] - Options
 * @param {boolean} [options.allowFix=false] - Whether fix options are supported for this domain
 * @returns {Promise<Object>} Resolved single domain configuration options
 */
export async function promptSingleDomainOptions (domain, options = {}) {
  clack.intro(`🪸 Coralite Interactive ${domain.charAt(0).toUpperCase() + domain.slice(1)} Pass`)

  let fixMode = 'validate'
  if (options.allowFix) {
    fixMode = handleCancel(await clack.select({
      message: 'Select execution mode:',
      options: [
        {
          value: 'validate',
          label: 'Validate only',
          hint: 'Report issues without modifying files'
        },
        {
          value: 'fix',
          label: 'Apply auto-fixes (--fix)',
          hint: 'Modify files on disk'
        },
        {
          value: 'dry-run',
          label: 'Preview auto-fixes (--dry-run)',
          hint: 'Display diffs without modifying files'
        }
      ]
    }))
  }

  const selectedErrorCodes = await promptErrorCodeFilter()

  const defaultStatus = selectedErrorCodes && selectedErrorCodes.length > 0 ? 'failed' : 'all'

  const statusChoice = handleCancel(await clack.select({
    message: 'Select status display filter:',
    options: [
      {
        value: 'failed',
        label: 'Only failed / broken files',
        hint: 'Suppress passed VALID files'
      },
      {
        value: 'all',
        label: 'All files',
        hint: 'Show both passed and failed files'
      },
      {
        value: 'passed',
        label: 'Only passed files'
      }
    ],
    initialValue: defaultStatus
  }))

  clack.outro('Configuration complete. Executing...')

  return {
    fix: fixMode === 'fix',
    dryRun: fixMode === 'dry-run',
    errorCode: selectedErrorCodes,
    status: statusChoice,
    onlyFailed: statusChoice === 'failed'
  }
}

/**
 * Prompt for immediate post-dry-run fix confirmation.
 *
 * @returns {Promise<boolean>} True if user confirmed applying fixes to disk
 */
export async function confirmApplyFixes () {
  const answer = handleCancel(await clack.confirm({
    message: 'Apply these changes to disk now?',
    initialValue: false
  }))
  return Boolean(answer)
}
