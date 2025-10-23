import { z } from 'zod'

/**
 * Schema for finding common log patterns within a specific time range.
 * This helps identify recurring patterns and group similar logs.
 *
 * @param from - Start time for the log query (POSIX timestamp)
 * @param to - End time for the log query (POSIX timestamp)
 * @param query - Base query to filter logs (e.g., 'service:api')
 * @param service - Specific service to analyze patterns for
 * @param limit - Maximum number of log entries to analyze (pagination size)
 * @param max_patterns - Maximum number of patterns to return
 * @param min_occurrences - Minimum occurrences for a pattern to be included
 * @param similarity_threshold - Threshold for grouping similar logs (0.0-1.0)
 * @param include_variables - Whether to extract variable parts of patterns
 */
export const FindLogPatternsZodSchema = z.object({
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  query: z
    .string()
    .optional()
    .default('')
    .describe('Base query to filter logs'),
  service: z
    .string()
    .optional()
    .describe('Specific service to analyze patterns for'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(500)
    .describe('Maximum number of log entries to analyze (pagination size)'),
  max_patterns: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of patterns to return'),
  min_occurrences: z
    .number()
    .int()
    .min(2)
    .optional()
    .default(5)
    .describe('Minimum occurrences for a pattern to be included'),
  similarity_threshold: z
    .number()
    .min(0.1)
    .max(1.0)
    .optional()
    .default(0.7)
    .describe('Threshold for grouping similar logs (0.0-1.0)'),
  include_variables: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to extract variable parts of patterns'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Cursor for pagination. Use the cursor from the previous response.',
    ),
  max_processing_time: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .optional()
    .default(30000)
    .describe(
      'Maximum processing time in milliseconds before returning interim results (defaults to 30 seconds)',
    ),
})

/**
 * Schema for extracting and categorizing error signatures from logs.
 * This focuses specifically on error patterns and their characteristics.
 *
 * @param from - Start time for the log query (POSIX timestamp)
 * @param to - End time for the log query (POSIX timestamp)
 * @param query - Base query to filter logs (defaults to error logs)
 * @param limit - Maximum number of log entries to analyze (pagination size)
 * @param group_by_location - Whether to group errors by code location
 * @param extract_stack_frames - Number of stack frames to extract from errors
 * @param max_error_groups - Maximum number of distinct error groups to return
 */
export const ExtractErrorSignaturesZodSchema = z.object({
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  query: z
    .string()
    .optional()
    .default('status:error OR level:error')
    .describe('Base query to filter logs (defaults to error logs)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(500)
    .describe('Maximum number of log entries to analyze (pagination size)'),
  group_by_location: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to group errors by code location'),
  extract_stack_frames: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .default(3)
    .describe('Number of stack frames to extract from errors'),
  max_error_groups: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(15)
    .describe('Maximum number of distinct error groups to return'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Cursor for pagination. Use the cursor from the previous response.',
    ),
  max_processing_time: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .optional()
    .default(30000)
    .describe(
      'Maximum processing time in milliseconds before returning interim results (defaults to 30 seconds)',
    ),
})

/**
 * Schema for detecting anomalous log patterns by comparing with a baseline period.
 * This identifies unusual patterns or frequency changes that may indicate problems.
 *
 * @param from - Start time for analysis period (POSIX timestamp)
 * @param to - End time for analysis period (POSIX timestamp)
 * @param baseline_from - Start time for baseline period (POSIX timestamp)
 * @param baseline_to - End time for baseline period (POSIX timestamp)
 * @param query - Base query to filter logs
 * @param limit - Maximum number of log entries to analyze (pagination size)
 * @param sensitivity - Anomaly detection sensitivity (1-10)
 * @param monitor_id - Specific monitor ID to correlate with anomalies
 * @param max_anomalies - Maximum number of anomalies to return
 */
export const DetectAnomalousPatternsZodSchema = z.object({
  from: z.number().describe('Start time for analysis period in epoch seconds'),
  to: z.number().describe('End time for analysis period in epoch seconds'),
  baseline_from: z
    .number()
    .describe('Start time for baseline period in epoch seconds'),
  baseline_to: z
    .number()
    .describe('End time for baseline period in epoch seconds'),
  query: z
    .string()
    .optional()
    .default('')
    .describe('Base query to filter logs'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(500)
    .describe(
      'Maximum number of log entries to analyze per period (pagination size)',
    ),
  sensitivity: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Anomaly detection sensitivity (1-10)'),
  monitor_id: z
    .number()
    .int()
    .optional()
    .describe('Specific monitor ID to correlate with anomalies'),
  max_anomalies: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of anomalies to return'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Cursor for pagination. Use the cursor from the previous response.',
    ),
  baseline_cursor: z
    .string()
    .optional()
    .describe('Cursor for baseline period pagination.'),
  max_processing_time: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .optional()
    .default(30000)
    .describe(
      'Maximum processing time in milliseconds before returning interim results (defaults to 30 seconds)',
    ),
})

export type FindLogPatternsArgs = z.infer<typeof FindLogPatternsZodSchema>
export type ExtractErrorSignaturesArgs = z.infer<
  typeof ExtractErrorSignaturesZodSchema
>
export type DetectAnomalousPatternsArgs = z.infer<
  typeof DetectAnomalousPatternsZodSchema
>
