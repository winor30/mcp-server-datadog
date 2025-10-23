import { z } from 'zod'

/**
 * Schema for listing SLOs from Datadog.
 * This allows retrieving and filtering service level objectives.
 *
 * @param query - Search query to filter SLOs
 * @param ids - Specific SLO IDs to retrieve
 * @param tags - Filter SLOs by tags
 * @param metrics_tags - Filter SLOs by metrics tags
 * @param names - Filter SLOs by names
 * @param timeframe - Filter SLOs by SLO timeframe
 * @param monitor_ids - Filter SLOs by monitor IDs
 * @param limit - Maximum number of SLOs to return
 * @param offset - Pagination offset
 */
export const ListSLOsZodSchema = z.object({
  query: z.string().optional().describe('Search query to filter SLOs by name'),
  ids: z.array(z.string()).optional().describe('Specific SLO IDs to retrieve'),
  tags: z.array(z.string()).optional().describe('Filter SLOs by tags'),
  metrics_tags: z
    .array(z.string())
    .optional()
    .describe('Filter SLOs by metrics tags'),
  names: z.array(z.string()).optional().describe('Filter SLOs by names'),
  timeframe: z
    .enum(['7d', '30d', '90d', 'custom', 'all'])
    .optional()
    .default('all')
    .describe('Filter SLOs by SLO timeframe'),
  monitor_ids: z
    .array(z.number())
    .optional()
    .describe('Filter SLOs by monitor IDs'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Maximum number of SLOs to return per page (max 100)'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Pagination offset'),
})

/**
 * Schema for retrieving a specific SLO by ID.
 *
 * @param id - The ID of the SLO to retrieve
 */
export const GetSLOZodSchema = z.object({
  id: z.string().describe('The ID of the SLO to retrieve'),
})

/**
 * Schema for retrieving history and error budget for an SLO.
 * This provides status over time and helps with burn rate analysis.
 *
 * @param id - The ID of the SLO to retrieve history for
 * @param from - Start time for history query (POSIX timestamp)
 * @param to - End time for history query (POSIX timestamp)
 * @param target - Specific SLO target to focus on (e.g., 99.9%)
 * @param show_error_budget - Whether to show error budget calculations
 * @param show_burn_rate - Whether to include burn rate calculations in the response
 */
export const GetSLOHistoryZodSchema = z.object({
  id: z.string().describe('The ID of the SLO to retrieve history for'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  target: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Specific SLO target to focus on (e.g., 99.9)'),
  show_error_budget: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to show error budget calculations'),
  show_burn_rate: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include burn rate calculations in the response'),
})

/**
 * Schema for checking multiple SLOs at once to find those in danger.
 * This is useful for quickly identifying SLOs at risk during incidents.
 *
 * @param query - Search query to filter SLOs
 * @param tags - Filter SLOs by tags
 * @param timeframe - SLO timeframe to check (7d, 30d, 90d)
 * @param threshold - Warning threshold percentage for error budget burn
 * @param with_burn_rate - Whether to include burn rate calculations
 */
export const CheckSLOsZodSchema = z.object({
  query: z.string().optional().describe('Search query to filter SLOs by name'),
  tags: z.array(z.string()).optional().describe('Filter SLOs by tags'),
  timeframe: z
    .enum(['7d', '30d', '90d'])
    .optional()
    .default('7d')
    .describe('SLO timeframe to check'),
  threshold: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(10)
    .describe(
      'Warning threshold percentage for error budget burn (e.g., 10 means alert when 10% of error budget is consumed)',
    ),
  with_burn_rate: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include burn rate calculations'),
})

export type ListSLOsArgs = z.infer<typeof ListSLOsZodSchema>
export type GetSLOArgs = z.infer<typeof GetSLOZodSchema>
export type GetSLOHistoryArgs = z.infer<typeof GetSLOHistoryZodSchema>
export type CheckSLOsArgs = z.infer<typeof CheckSLOsZodSchema>
