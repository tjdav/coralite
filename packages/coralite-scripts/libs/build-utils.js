import colours from 'kleur'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Creates current time in format [HH:MM:SS].mmm (milliseconds), colored with ANSI colors, and formatted as bold white string for better readability of logs or console output
 * @returns {string} - Formatted timestamp to be used within a log message.
 */
export function toTime () {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0')

  return '[' + colours.magenta(`${hours}:${minutes}:${seconds}.${milliseconds}`) + '] '
}

/**
 * Creates a formatted timestamp in milliseconds with ANSI colors and bold white string for better readability of logs or console output.
 * @param {[number, number] | number } hrtime - High Resolution Time in microseconds since epoch, used to calculate time difference between two points of execution or the start/stopwatch function call respectively.
 */
export function toMS (hrtime) {
  let number

  if (Array.isArray(hrtime)) {
    number = (hrtime[1] / 1e6).toFixed(2) + 'ms'
  } else {
    number = hrtime.toFixed(2) + 'ms'
  }

  return colours.white().bold(number)
}

/**
 * Converts HTTP status code into a colourised text.
 * @param {number} code - HTTP status code to convert into a colourised text.
 */
export function toCode (code) {
  let fn = 'green'

  if (code >= 400) {
    fn = 'red'
  } else if (code > 300) {
    fn = 'yellow'
  }

  return colours[fn](code)
}

/**
 * Recursively copies a directory and all its contents from source to destination
 * @param {string} src - The source directory path to copy from
 * @param {string} dest - The destination directory path to copy to
 */
export function copyDirectory (src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  // Read source directory contents
  const entries = fs.readdirSync(src)

  for (const entry of entries) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)

    // Check if it's a file or directory and copy accordingly
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath) // Recursive call for subdirectories
    } else {
      fs.copyFileSync(srcPath, destPath) // Copy files
    }
  }
}

/**
 * Recursively deletes a directory and all its contents
 * @param {string} dirPath - The path to the directory to delete
 */
export function deleteDirectoryRecursive (dirPath) {
  // Check if directory exists before attempting deletion
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dirPath} does not exist`)
    return
  }

  // Read all files in the directory
  const files = fs.readdirSync(dirPath)

  // Iterate through each file/directory in the target directory
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)

    // If current item is a directory, recursively delete it
    if (stat.isDirectory()) {
      deleteDirectoryRecursive(filePath)
    } else {
      // If current item is a file, delete it directly
      fs.unlinkSync(filePath)
    }
  }

  // Remove the now-empty directory
  fs.rmdirSync(dirPath)
}


/**
 * Prettified error display using kleur
 * @param {string} message - Error message
 * @param {unknown} [error] - Optional error object
 */
export function displayError (message, error) {
  const dash = colours.gray(' ─ ')
  process.stdout.write(toTime() + colours.bgRed().white(' ERROR ') + dash + colours.red(message) + '\n')
  if (error) {
    const indent = '    '
    let errorDetails = ''

    if (error instanceof Error) {
      errorDetails = error.stack || error.message
    } else if (typeof error === 'string') {
      errorDetails = error
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = JSON.stringify(error, null, 2)
    } else {
      errorDetails = String(error)
    }

    const errorLines = errorDetails.split('\n')
    let firstLine = true

    const errorResult = errorLines.reduce((previousValue, currentValue) => {
      if (firstLine) {
        previousValue += colours.red(indent + currentValue + '\n')
        firstLine = false
      } else {
        previousValue += colours.grey(indent + currentValue + '\n')
      }

      return previousValue
    }, '')
    process.stdout.write(errorResult + '\n')
  }
}

/**
 * Prettified warning display using kleur
 * @param {string} message - Warning message
 */
export function displayWarning (message) {
  const dash = colours.gray(' ─ ')
  process.stdout.write(toTime() + colours.bgYellow().black(' WARNING ') + dash + colours.yellow(message) + '\n')
}

/**
 * Prettified success display using kleur
 * @param {string} message - Success message
 */
export function displaySuccess (message) {
  const dash = colours.gray(' ─ ')
  process.stdout.write(toTime() + colours.bgGreen().white(' SUCCESS ') + dash + colours.green(message) + '\n')
}

/**
 * Prettified info display using kleur
 * @param {string} message - Info message
 */
export function displayInfo (message) {
  const dash = colours.gray(' ─ ')
  process.stdout.write(toTime() + colours.bgBlue().white(' INFO ') + dash + colours.blue(message) + '\n')
}
