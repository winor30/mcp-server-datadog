/**
 * LLM-friendly datetime parser for Datadog MCP server.
 * Supports multiple datetime formats and converts them to epoch seconds.
 * Uses chrono-node for natural language parsing with custom preprocessing
 * for abbreviated formats that LLMs commonly generate.
 */

import * as chrono from 'chrono-node'

export type DatetimeInput = number | string

// Map abbreviated units to full words for chrono
const UNIT_NAMES: Record<string, string> = {
  s: 'second',
  sec: 'second',
  secs: 'second',
  second: 'second',
  seconds: 'second',
  m: 'minute',
  min: 'minute',
  mins: 'minute',
  minute: 'minute',
  minutes: 'minute',
  h: 'hour',
  hr: 'hour',
  hrs: 'hour',
  hour: 'hour',
  hours: 'hour',
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  mo: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  years: 'year',
}

const UNIT_SECONDS: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
}

/**
 * Normalize abbreviated time expressions to chrono-friendly format.
 * Handles: "1d ago", "2h ago", "minus 3 days", etc.
 */
function normalizeInput(str: string): string {
  // "1d ago", "2h ago", "30m ago" -> "1 day ago", "2 hours ago"
  const agoMatch = str.match(/^(\d+)\s*([a-z]+)\s+ago$/i)
  if (agoMatch) {
    const num = agoMatch[1]
    const unit = UNIT_NAMES[agoMatch[2].toLowerCase()]
    if (unit) {
      const plural = parseInt(num) === 1 ? '' : 's'
      return `${num} ${unit}${plural} ago`
    }
  }

  // "in 1d", "in 2h" -> "in 1 day", "in 2 hours"
  const inMatch = str.match(/^in\s+(\d+)\s*([a-z]+)$/i)
  if (inMatch) {
    const num = inMatch[1]
    const unit = UNIT_NAMES[inMatch[2].toLowerCase()]
    if (unit) {
      const plural = parseInt(num) === 1 ? '' : 's'
      return `in ${num} ${unit}${plural}`
    }
  }

  // "minus 1 day", "minus 2 hours" -> "1 day ago", "2 hours ago"
  const minusMatch = str.match(/^minus\s+(\d+)\s*([a-z]+)$/i)
  if (minusMatch) {
    const num = minusMatch[1]
    const unit = UNIT_NAMES[minusMatch[2].toLowerCase()]
    if (unit) {
      const plural = parseInt(num) === 1 ? '' : 's'
      return `${num} ${unit}${plural} ago`
    }
  }

  // "plus 1 day", "plus 2 hours" -> "in 1 day", "in 2 hours"
  const plusMatch = str.match(/^plus\s+(\d+)\s*([a-z]+)$/i)
  if (plusMatch) {
    const num = plusMatch[1]
    const unit = UNIT_NAMES[plusMatch[2].toLowerCase()]
    if (unit) {
      const plural = parseInt(num) === 1 ? '' : 's'
      return `in ${num} ${unit}${plural}`
    }
  }

  return str
}

/**
 * Parse a datetime input and return epoch seconds.
 * Supports:
 * - Epoch seconds (number): 1732795200
 * - Shorthand offsets: -1d, 2h, +1w
 * - Relative time strings: now, now-1h, now-30m, now-7d, now-2w
 * - Abbreviated formats: 1d ago, 2h ago, in 1d, minus 1 day
 * - Natural language: yesterday, last Friday, 5 days ago, next Monday
 * - ISO 8601 strings: 2025-11-28T12:00:00Z, 2025-11-28
 */
export function parseDatetime(input: DatetimeInput): number {
  // If already a number, return as-is (backward compatible)
  if (typeof input === 'number') {
    return input
  }

  const now = Math.floor(Date.now() / 1000)
  const str = input.trim().toLowerCase()

  // Handle "now" explicitly
  if (str === 'now') {
    return now
  }

  // Handle shorthand offsets: -1d, -2h, +1d, 1d (bare number+unit = past)
  const shorthandMatch = str.match(/^([+-]?)(\d+)\s*([a-z]+)$/)
  if (shorthandMatch && !str.includes(' ')) {
    const sign = shorthandMatch[1]
    const value = parseInt(shorthandMatch[2], 10)
    const unitKey = shorthandMatch[3].toLowerCase()
    const unit = UNIT_NAMES[unitKey]

    if (unit && UNIT_SECONDS[unit]) {
      // No sign or "-" = past, "+" = future
      const direction = sign === '+' ? 1 : -1
      return now + direction * value * UNIT_SECONDS[unit]
    }
  }

  // Handle now-1h, now+1d format
  const nowRelativeMatch = str.match(/^now\s*([+-])\s*(\d+)\s*([a-z]+)$/i)
  if (nowRelativeMatch) {
    const sign = nowRelativeMatch[1] === '-' ? -1 : 1
    const value = parseInt(nowRelativeMatch[2], 10)
    const unitKey = nowRelativeMatch[3].toLowerCase()
    const unit = UNIT_NAMES[unitKey]

    if (unit && UNIT_SECONDS[unit]) {
      return now + sign * value * UNIT_SECONDS[unit]
    }
  }

  // Normalize abbreviated formats before passing to chrono
  const normalized = normalizeInput(str)

  // Use chrono for natural language
  const parsed = chrono.parseDate(normalized)
  if (parsed) {
    return Math.floor(parsed.getTime() / 1000)
  }

  throw new Error(
    `Invalid datetime format: "${input}". Supported formats: ` +
      'epoch seconds, shorthand (-1d, 2h, +1w), relative (now-1h), ' +
      'natural language (yesterday, 5 days ago, last Friday, in 2 weeks), ISO 8601',
  )
}

/**
 * Description string for datetime parameters in tool schemas.
 */
export const DATETIME_DESCRIPTION =
  'Time specification. Accepts: epoch seconds, shorthand (-1d, 2h, +1w), ' +
  'relative (now-1h, now+2d), natural language (yesterday, 5 days ago, ' +
  '2h ago, last Friday, in 2 weeks, minus 1 day), ISO 8601 (2025-11-28T12:00:00Z)'
