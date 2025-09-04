import colours from 'kleur'

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
 * @param {[number, number]} hrtime - High Resolution Time in microseconds since epoch, used to calculate time difference between two points of execution or the start/stopwatch function call respectively.
 */
export function toMS (hrtime) {
  return colours.white().bold(`${(hrtime[1] / 1e6).toFixed(2)}ms`)
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
