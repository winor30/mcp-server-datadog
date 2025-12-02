import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseDatetime,
  DATETIME_DESCRIPTION,
} from '../../src/utils/datetime-parser'

describe('parseDatetime', () => {
  const FIXED_NOW = 1732800000 // 2024-11-28T12:00:00Z in epoch seconds

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW * 1000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('number input (epoch seconds)', () => {
    it('should return the number as-is', () => {
      expect(parseDatetime(1732713600)).toBe(1732713600)
    })

    it('should handle zero', () => {
      expect(parseDatetime(0)).toBe(0)
    })
  })

  describe('relative time expressions', () => {
    it('should parse "now"', () => {
      expect(parseDatetime('now')).toBe(FIXED_NOW)
    })

    it('should parse "NOW" (case insensitive)', () => {
      expect(parseDatetime('NOW')).toBe(FIXED_NOW)
    })

    it('should parse "now-1h"', () => {
      expect(parseDatetime('now-1h')).toBe(FIXED_NOW - 3600)
    })

    it('should parse "now-30m"', () => {
      expect(parseDatetime('now-30m')).toBe(FIXED_NOW - 30 * 60)
    })

    it('should parse "now-7d"', () => {
      expect(parseDatetime('now-7d')).toBe(FIXED_NOW - 7 * 86400)
    })

    it('should parse "now-2w"', () => {
      expect(parseDatetime('now-2w')).toBe(FIXED_NOW - 2 * 604800)
    })

    it('should parse "now-60s"', () => {
      expect(parseDatetime('now-60s')).toBe(FIXED_NOW - 60)
    })

    it('should handle uppercase "NOW-1H"', () => {
      expect(parseDatetime('NOW-1H')).toBe(FIXED_NOW - 3600)
    })
  })

  describe('shorthand offsets', () => {
    it('should parse "-1d"', () => {
      expect(parseDatetime('-1d')).toBe(FIXED_NOW - 86400)
    })

    it('should parse "1d" as past (default)', () => {
      expect(parseDatetime('1d')).toBe(FIXED_NOW - 86400)
    })

    it('should parse "+1d" as future', () => {
      expect(parseDatetime('+1d')).toBe(FIXED_NOW + 86400)
    })

    it('should parse "-2h"', () => {
      expect(parseDatetime('-2h')).toBe(FIXED_NOW - 2 * 3600)
    })

    it('should parse "-30m"', () => {
      expect(parseDatetime('-30m')).toBe(FIXED_NOW - 30 * 60)
    })

    it('should parse "1w"', () => {
      expect(parseDatetime('1w')).toBe(FIXED_NOW - 604800)
    })
  })

  describe('shortcut expressions (via chrono)', () => {
    it('should parse "yesterday"', () => {
      const result = parseDatetime('yesterday')
      // chrono uses local timezone, so we just check it's roughly 1 day ago
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 2 * 86400)
    })

    it('should parse "today"', () => {
      const result = parseDatetime('today')
      // chrono uses local timezone for "today" at midnight
      expect(result).toBeLessThanOrEqual(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 86400)
    })

    it('should parse "last week"', () => {
      const result = parseDatetime('last week')
      // chrono interprets "last week" as previous week
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 14 * 86400)
    })

    it('should parse "last month"', () => {
      const result = parseDatetime('last month')
      // chrono interprets "last month" as previous month
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 62 * 86400)
    })

    it('should handle "YESTERDAY" (case insensitive)', () => {
      const result = parseDatetime('YESTERDAY')
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 2 * 86400)
    })
  })

  describe('abbreviated formats', () => {
    it('should parse "1d ago"', () => {
      const result = parseDatetime('1d ago')
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 2 * 86400)
    })

    it('should parse "2h ago"', () => {
      const result = parseDatetime('2h ago')
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 3 * 3600)
    })

    it('should parse "5 days ago"', () => {
      const result = parseDatetime('5 days ago')
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 6 * 86400)
    })

    it('should parse "in 1d"', () => {
      const result = parseDatetime('in 1d')
      expect(result).toBeGreaterThan(FIXED_NOW)
      expect(result).toBeLessThan(FIXED_NOW + 2 * 86400)
    })

    it('should parse "minus 1 day"', () => {
      const result = parseDatetime('minus 1 day')
      expect(result).toBeLessThan(FIXED_NOW)
      expect(result).toBeGreaterThan(FIXED_NOW - 2 * 86400)
    })

    it('should parse "plus 2 hours"', () => {
      const result = parseDatetime('plus 2 hours')
      expect(result).toBeGreaterThan(FIXED_NOW)
      expect(result).toBeLessThan(FIXED_NOW + 3 * 3600)
    })
  })

  describe('ISO 8601 formats', () => {
    it('should parse full ISO datetime with Z', () => {
      const result = parseDatetime('2024-11-27T10:30:00Z')
      expect(result).toBe(Math.floor(Date.parse('2024-11-27T10:30:00Z') / 1000))
    })

    it('should parse ISO date only', () => {
      const result = parseDatetime('2024-11-27')
      // chrono parses dates, result should be close to midnight on that day
      expect(result).toBeGreaterThan(
        Math.floor(Date.parse('2024-11-26T00:00:00Z') / 1000),
      )
      expect(result).toBeLessThan(
        Math.floor(Date.parse('2024-11-28T00:00:00Z') / 1000),
      )
    })

    it('should parse ISO datetime with timezone offset', () => {
      const result = parseDatetime('2024-11-27T10:30:00+02:00')
      expect(result).toBe(
        Math.floor(Date.parse('2024-11-27T10:30:00+02:00') / 1000),
      )
    })
  })

  describe('whitespace handling', () => {
    it('should trim leading/trailing whitespace', () => {
      expect(parseDatetime('  now  ')).toBe(FIXED_NOW)
    })

    it('should trim whitespace from relative time', () => {
      expect(parseDatetime('  now-1h  ')).toBe(FIXED_NOW - 3600)
    })
  })

  describe('error handling', () => {
    it('should throw for invalid format', () => {
      expect(() => parseDatetime('invalid')).toThrow(
        'Invalid datetime format: "invalid"',
      )
    })

    it('should throw for empty string', () => {
      expect(() => parseDatetime('')).toThrow('Invalid datetime format')
    })
  })
})

describe('DATETIME_DESCRIPTION', () => {
  it('should contain documentation for all supported formats', () => {
    expect(DATETIME_DESCRIPTION).toContain('epoch seconds')
    expect(DATETIME_DESCRIPTION).toContain('shorthand')
    expect(DATETIME_DESCRIPTION).toContain('-1d')
    expect(DATETIME_DESCRIPTION).toContain('now-1h')
    expect(DATETIME_DESCRIPTION).toContain('ISO 8601')
    expect(DATETIME_DESCRIPTION).toContain('yesterday')
    expect(DATETIME_DESCRIPTION).toContain('natural language')
  })
})
