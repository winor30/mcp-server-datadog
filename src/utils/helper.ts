import * as chrono from 'chrono-node'
import { version as mcpDatadogVersion } from '../../package.json'

/**
 * Logs a formatted message with a specified severity to stderr.
 *
 * The MCP server uses stdio transport, so using console.log might interfere with the transport.
 * Therefore, logging messages are written to stderr.
 *
 * @param {'info' | 'error'} severity - The severity level of the log message.
 * @param {...any[]} args - Additional arguments to be logged, which will be concatenated into a single string.
 */
export function log(
  severity: 'info' | 'error',
  ...args: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const msg = `[${severity.toUpperCase()} ${new Date().toISOString()}] ${args.join(' ')}\n`
  process.stderr.write(msg)
}

export { mcpDatadogVersion }

export function unreachable(value: never): never {
  throw new Error(`Unreachable code: ${value}`)
}

/**
 * Parse relative time expressions and convert to proper timestamps using chrono-node
 * Handles expressions like "past X minutes/hours/days/weeks/months", "X ago", "yesterday", etc.
 *
 * @param query Original query string that might contain relative time expressions
 * @param from Current 'from' timestamp (epoch seconds)
 * @param to Current 'to' timestamp (epoch seconds)
 * @returns Object with possibly adjusted from/to timestamps and whether adjustment was made
 */
export function parseRelativeTimeInQuery(
  query: string,
  from?: number,
  to?: number,
): { from?: number; to?: number; wasAdjusted: boolean } {
  const now = Math.floor(Date.now() / 1000)
  let wasAdjusted = false

  // Step 1: Check for obviously outdated timestamps (e.g., timestamps from a year ago)
  // This is a special case since incorrect timestamps often come from Claude
  if (to && Math.abs(now - to) > 86400) {
    // More than 1 day difference
    const toDate = new Date(to * 1000)
    const currentYear = new Date().getFullYear()

    // If the timestamp is from a previous year, it's most likely incorrect
    if (toDate.getFullYear() < currentYear) {
      log(
        'info',
        `Detected timestamp from previous year ${toDate.getFullYear()} (likely incorrect). Auto-correcting...`,
      )

      // Default to "past hour" when detecting year mismatch
      const newTo = now
      const newFrom = now - 3600 // 1 hour

      // Log the adjustment
      const formattedNewFrom = new Date(newFrom * 1000).toISOString()
      const formattedNewTo = new Date(newTo * 1000).toISOString()
      const formattedOldFrom = from
        ? new Date(from * 1000).toISOString()
        : 'undefined'
      const formattedOldTo = toDate.toISOString()

      log(
        'info',
        `Timestamp auto-correction (previous year detected):
        From: ${formattedOldFrom} -> ${formattedNewFrom}
        To: ${formattedOldTo} -> ${formattedNewTo}`,
      )

      return { from: newFrom, to: newTo, wasAdjusted: true }
    }
  }

  // Step 2: If no query or nothing to process, return early
  if (!query || query.trim() === '') {
    return { from, to, wasAdjusted }
  }

  // Step 3: Look for time expressions using chrono-node
  // Common relative time patterns we want to detect
  const relativePhrases = [
    'past hour',
    'last hour',
    'past day',
    'last day',
    'past week',
    'last week',
    'past month',
    'last month',
    'hour ago',
    'day ago',
    'week ago',
    'month ago',
    'minutes ago',
    'hours ago',
    'days ago',
    'weeks ago',
    'today',
    'yesterday',
  ]

  // Check if any of the phrases are in the query
  const lowerQuery = query.toLowerCase()
  const foundPhrase = relativePhrases.find((phrase) =>
    lowerQuery.includes(phrase),
  )

  if (foundPhrase) {
    // Use chrono-node to parse the relative time expression
    try {
      // Create reference date for "now"
      const refDate = new Date(now * 1000)

      // Parse the time expression
      // For "past X" or "last X" expressions, we need to build a proper phrase
      let parseText = foundPhrase

      // Handle "past/last X" phrases by constructing "X ago" for chrono
      if (parseText.startsWith('past ') || parseText.startsWith('last ')) {
        const unit = parseText.split(' ')[1]
        parseText = `1 ${unit} ago`
      }

      // Parse the date
      const parsedDate = chrono.parseDate(parseText, refDate, {
        forwardDate: false,
      })

      if (parsedDate) {
        // For expressions like "past hour", calculate proper range
        const newTo = Math.floor(refDate.getTime() / 1000) // now
        let newFrom

        if (parseText === 'today') {
          // Start of today
          const todayStart = new Date(refDate)
          todayStart.setHours(0, 0, 0, 0)
          newFrom = Math.floor(todayStart.getTime() / 1000)
        } else if (parseText === 'yesterday') {
          // Start of yesterday
          const yesterdayStart = new Date(refDate)
          yesterdayStart.setDate(yesterdayStart.getDate() - 1)
          yesterdayStart.setHours(0, 0, 0, 0)
          newFrom = Math.floor(yesterdayStart.getTime() / 1000)
        } else {
          // For all other expressions, use the parsed date as start time
          newFrom = Math.floor(parsedDate.getTime() / 1000)
        }

        // Check if there's a significant difference from provided timestamps
        const isSignificantChange =
          !to ||
          !from ||
          Math.abs(to - newTo) > 3600 ||
          Math.abs(from - newFrom) > 3600

        if (isSignificantChange) {
          wasAdjusted = true

          // Log the change
          const formattedNewFrom = new Date(newFrom * 1000).toISOString()
          const formattedNewTo = new Date(newTo * 1000).toISOString()
          const formattedOldFrom = from
            ? new Date(from * 1000).toISOString()
            : 'undefined'
          const formattedOldTo = to
            ? new Date(to * 1000).toISOString()
            : 'undefined'

          log(
            'info',
            `Adjusting timestamps for "${foundPhrase}" using chrono-node:
            From: ${formattedOldFrom} -> ${formattedNewFrom}
            To: ${formattedOldTo} -> ${formattedNewTo}`,
          )

          return { from: newFrom, to: newTo, wasAdjusted }
        }
      }
    } catch (error) {
      log('error', `Error parsing date with chrono-node: ${error}`)
      // Continue with other checks if chrono fails
    }
  }

  // If no adjustment made but timestamps seem off, log a warning
  if (to && Math.abs(now - to) > 86400) {
    log(
      'info',
      `Warning: Timestamps may be outdated (${new Date(to * 1000).toISOString()}), but no clear relative time expression recognized in query.`,
    )
  }

  return { from, to, wasAdjusted }
}
