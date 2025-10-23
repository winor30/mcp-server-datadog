import { z } from 'zod'

/**
 * Available anomaly detection algorithms
 * - basic: Fast response to changes, more false positives
 * - agile: Good for seasonal metrics with regular patterns
 * - robust: Conservative detection with fewer false positives
 * - adaptive: Dynamically adjusts to overall standard deviation
 */
export const AnomalyAlgorithmEnum = z.enum([
  'basic',
  'agile',
  'robust',
  'adaptive',
])

/**
 * Schema for anomaly detection requests
 *
 * Usage examples:
 *
 * 1. Basic anomaly detection:
 * datadog:get_anomalies (MCP)(
 *   metric: "avg:system.cpu.user{env:prod}",
 *   from: 1746103797,
 *   to: 1746190197
 * )
 *
 * 2. Advanced seasonality detection:
 * datadog:get_anomalies (MCP)(
 *   metric: "sum:api.requests{service:auth}",
 *   from: 1746103797,
 *   to: 1746190197,
 *   algorithm: "agile",
 *   threshold: 3,
 *   seasonality: "week"
 * )
 */
export const GetAnomaliesZodSchema = z.object({
  // The metric query to analyze (required)
  metric: z
    .string()
    .describe(
      'Metric to analyze for anomalies, e.g. "avg:system.cpu.user{env:prod}"',
    ),

  // Time range parameters (required)
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),

  // Algorithm parameters (with defaults)
  algorithm: AnomalyAlgorithmEnum.default('basic').describe(
    'Anomaly detection algorithm to use',
  ),

  threshold: z
    .number()
    .min(1)
    .max(5)
    .default(2)
    .describe(
      'Deviation threshold (1-5) - higher values detect only more extreme anomalies',
    ),

  // Seasonality parameters (optional)
  seasonality: z
    .enum(['hour', 'day', 'week'])
    .optional()
    .describe('Expected pattern frequency (for seasonal metrics)'),

  // Output formatting options
  includeNormal: z
    .boolean()
    .default(false)
    .describe('Include non-anomalous points in the response'),

  includeMetadata: z
    .boolean()
    .default(true)
    .describe('Include algorithm metadata in the response'),
})

// Export type for handler usage
export type GetAnomaliesArgs = z.infer<typeof GetAnomaliesZodSchema>
