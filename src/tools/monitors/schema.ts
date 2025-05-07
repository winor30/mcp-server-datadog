import { z } from 'zod'

export const GetMonitorsZodSchema = z.object({
  groupStates: z
    .array(z.enum(['alert', 'warn', 'no data', 'ok']))
    .optional()
    .describe(
      'Filter monitors by their states (e.g., alert, warn, no data, ok)',
    ),
  name: z
    .string()
    .optional()
    .describe('Filter monitors by name (case-sensitive)'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter monitors by tags (e.g., ["env:prod", "service:api"])'),
  idOffset: z
    .number()
    .int()
    .optional()
    .describe(
      'Start listing from this monitor ID. Use with pageSize=1 to get a specific monitor. For pagination, use the last monitor ID from previous response.',
    ),
  page: z
    .number()
    .int()
    .optional()
    .describe(
      'Page number for pagination (0-based). Use with pageSize parameter.',
    ),
  pageSize: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe(
      'Number of monitors per page (default: 100). Set to 1 with idOffset to get a specific monitor.',
    ),
})
