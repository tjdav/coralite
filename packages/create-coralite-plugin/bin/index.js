#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command, Option } from 'commander'
import * as prompts from '@clack/prompts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

import {
  copy,
  emptyDir,
  extractPackageInfoFromUserAgent,
  formatTargetDir,
  isEmpty,
  isValidPackageName,
  toValidPackageName
} from '../lib/utils.js'

const program = new Command()

program
  .name('create-coralite-plugin')
  .description('Create a new Coralite plugin project.')
  .version(pkg.version)

program
  .addOption(new Option('-o, --output <name>', 'target project directory').default(''))
  .addOption(new Option('-d, --description <text>', 'plugin description'))
  .addOption(new Option('-c, --ci <platform>', 'CI platform').choices(['none', 'github', 'gitlab', 'woodpecker', 'forgejo']))

program.parse()

const options = program.opts()
const cwd = process.cwd()

const defaultTarget = 'coralite-plugin'
const cancelPrompt = () => prompts.cancel('Operation cancelled')

const CI_PLATFORMS = [
  {
    value: 'none',
    label: 'None'
  },
  {
    value: 'github',
    label: 'GitHub Actions'
  },
  {
    value: 'gitlab',
    label: 'GitLab CI'
  },
  {
    value: 'woodpecker',
    label: 'Woodpecker CI'
  },
  {
    value: 'forgejo',
    label: 'Forgejo/Gitea Actions'
  }
]

async function createPlugin () {
  let target = options.output
  const pkgInfo = extractPackageInfoFromUserAgent(process.env.npm_config_user_agent)

  prompts.intro('🔌 Create Coralite Plugin')

  if (target) {
    target = formatTargetDir(options.output)
  } else {
    const projectName = await prompts.text({
      message: 'Project name:',
      defaultValue: defaultTarget,
      placeholder: defaultTarget,
      validate: (value) => {
        if (value.length && formatTargetDir(value).length === 0) {
          return 'Invalid project name'
        }
      }
    })

    if (prompts.isCancel(projectName)) return cancelPrompt()
    target = formatTargetDir(projectName)
  }

  if (fs.existsSync(target) && !isEmpty(target)) {
    const overwrite = await prompts.select({
      message: `Target directory "${target}" is not empty. Proceed?`,
      options: [
        {
          label: 'Cancel',
          value: 'no'
        },
        {
          label: 'Clear and continue',
          value: 'yes'
        }
      ]
    })
    if (prompts.isCancel(overwrite) || overwrite === 'no') return cancelPrompt()
    emptyDir(target)
  }

  let packageName = path.basename(path.resolve(target))
  if (!isValidPackageName(packageName)) {
    const name = await prompts.text({
      message: 'Package name:',
      defaultValue: toValidPackageName(packageName),
      placeholder: toValidPackageName(packageName),
      validate: (val) => (isValidPackageName(val) ? undefined : 'Invalid package name')
    })
    if (prompts.isCancel(name)) return cancelPrompt()
    packageName = name
  }

  let description = options.description
  if (!description) {
    description = await prompts.text({
      message: 'Description:',
      placeholder: 'A cool Coralite plugin',
      initialValue: ''
    })
    if (prompts.isCancel(description)) return cancelPrompt()
  }

  let ciPlatform = options.ci
  if (!ciPlatform) {
    const selected = await prompts.select({
      message: 'Select CI platform:',
      options: CI_PLATFORMS
    })
    if (prompts.isCancel(selected)) return cancelPrompt()
    ciPlatform = selected
  }

  const root = path.resolve(cwd, target)
  fs.mkdirSync(root, { recursive: true })

  const templateDir = path.resolve(fileURLToPath(import.meta.url), '../../templates/default')

  // Copy default template
  const files = fs.readdirSync(templateDir)
  for (const file of files.filter(f => f !== 'package.json')) {
    copy(path.join(templateDir, file), path.join(root, file))
  }

  // Update package.json
  const pkgJson = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json'), 'utf-8'))
  pkgJson.name = packageName
  pkgJson.description = description

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n')

  // Setup CI
  if (ciPlatform !== 'none') {
    const ciTemplateDir = path.resolve(fileURLToPath(import.meta.url), '../../templates/ci')
    const ciFile = path.join(ciTemplateDir, `${ciPlatform}.yml`)

    if (ciPlatform === 'github') {
      const dest = path.join(root, '.github/workflows/ci.yml')
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      copy(ciFile, dest)
    } else if (ciPlatform === 'gitlab') {
      copy(ciFile, path.join(root, '.gitlab-ci.yml'))
    } else if (ciPlatform === 'woodpecker') {
      const dest = path.join(root, '.woodpecker/ci.yml')
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      copy(ciFile, dest)
    } else if (ciPlatform === 'forgejo') {
      const dest = path.join(root, '.forgejo/workflows/ci.yml')
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      copy(ciFile, dest)
    }
  }

  // Rename _gitignore to .gitignore
  if (fs.existsSync(path.join(root, '_gitignore'))) {
    fs.renameSync(path.join(root, '_gitignore'), path.join(root, '.gitignore'))
  }

  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'

  let doneMessage = `\nDone. Now run:\n\n`
  if (root !== cwd) {
    doneMessage += `  cd ${path.relative(cwd, root)}\n`
  }
  doneMessage += `  ${pkgManager} install\n`
  doneMessage += `  ${pkgManager} test\n`

  prompts.outro(doneMessage)
}

createPlugin().catch(console.error)
