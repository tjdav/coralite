#!/usr/bin/env node

import fs, { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command, Option } from 'commander'
import * as prompts from '@clack/prompts'
import colours from 'kleur'
import pkg from '../package.json' with { type: 'json' }
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
  .name('create-coralite')
  .description('Create a new Coralite project.')
  .version(pkg.version)

program
  .addOption(
    new Option('-o, --output <name>', 'target project directory').default('')
  )

program
  .addOption(
    new Option('-t, --template <name>', 'use a specific template').choices([
      'css',
      'scss'
    ]).default('')
  )

program.parse()

const options = program.opts()
const cwd = process.cwd()
const { blue, magenta, cyan } = colours
const TEMPLATES = [
  {
    value: 'css',
    name: 'CSS',
    colour: cyan
  },
  {
    value: 'scss',
    name: 'SCSS',
    colour: magenta
  }
]
const defaultTarget = 'coralite-project'
const cancelPrompt = () => prompts.cancel('Operation cancelled')
const renameFiles = {
  _gitignore: '.gitignore'
}

async function createProject () {
  const argTemplate = options.template
  let target = options.output
  let template = argTemplate
  const pkgInfo = extractPackageInfoFromUserAgent(process.env.npm_config_user_agent)

  // get project name and target directory
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

    if (prompts.isCancel(projectName)) {
      return cancelPrompt()
    }

    target = formatTargetDir(projectName)
  }

  // handle directory if exist and not empty
  if (existsSync(target) && isEmpty(target)) {
    let message = `Target directory "${target}"`

    if (target === '.') {
      message = 'Current directory'
    }

    const targetOverwrite = await prompts.select({
      message: message + ' is not empty. Please choose how to proceed:',
      options: [
        {
          label: 'Cancel operation',
          value: 'no'
        },
        {
          label: 'Remove existing files and continue',
          value: 'yes'
        }
      ]
    })

    if (prompts.isCancel(targetOverwrite)) {
      return cancelPrompt()
    }

    if (targetOverwrite === 'yes') {
      emptyDir(target)
    } else if (targetOverwrite === 'no') {
      return cancelPrompt()
    }
  }

  // get package name
  let packageName = path.basename(path.resolve(target))

  if (!isValidPackageName(packageName)) {
    const packageNameResult = await prompts.text({
      message: 'Package name:',
      defaultValue: toValidPackageName(packageName),
      placeholder: toValidPackageName(packageName),
      validate (directory) {
        if (!isValidPackageName(directory)) {
          return 'Invalid package.json name'
        }
      }
    })

    if (prompts.isCancel(packageNameResult)) {
      return cancelPrompt()
    }

    packageName = packageNameResult
  }

  if (!template) {
    const selectedTemplate = await prompts.select({
      message: 'Please choose from below: ',
      options: TEMPLATES.map((template) => ({
        label: template.colour(template.name),
        value: template.value
      }))
    })

    if (prompts.isCancel(selectedTemplate)) {
      return cancelPrompt()
    }

    template = selectedTemplate
  }

  const root = path.resolve(cwd, target)
  fs.mkdirSync(root, { recursive: true })

  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../..',
    `templates/${template}`
  )

  // copy files
  const write = (file, content) => {
    const targetPath = path.join(root, renameFiles[file] ?? file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }

  // read all files from template
  const files = fs.readdirSync(templateDir)

  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }

  // update package.json
  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, 'package.json'), 'utf-8')
  )
  pkg.name = packageName
  write('package.json', JSON.stringify(pkg, null, 2) + '\n')

  // show success message
  let doneMessage = ''
  const cdProjectName = path.relative(cwd, root)
  doneMessage += `Done. Now run:\n`

  if (root !== cwd) {
    doneMessage += `\n  cd ${
      cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName
    }`
  }

  if (pkgManager === 'yarn') {
    doneMessage += '\n  yarn'
    doneMessage += '\n  yarn start'
  } else {
    doneMessage += `\n  ${pkgManager} install`
    doneMessage += `\n  ${pkgManager} run start`
  }

  prompts.outro(doneMessage)
}

createProject().catch((console.error))
