import { z } from 'zod'

export const ListAuditLogsZodSchema = z.object({
  query: z
    .string()
    .default('')
    .describe(
      'Datadog audit logs query string (e.g. @asset.type:monitor @asset.id:12345)',
    ),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(25)
    .describe('Maximum number of audit events to return. Default is 25.'),
})

export const SearchAuditLogsZodSchema = z.object({
  query: z
    .string()
    .default('')
    .describe(
      'Datadog audit logs query string (e.g. @asset.type:monitor @asset.id:12345)',
    ),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(25)
    .describe('Maximum number of audit events to return. Default is 25.'),
  sort: z
    .string()
    .optional()
    .default('-timestamp')
    .describe(
      'Sort order for results. Use -timestamp for newest first, timestamp for oldest first.',
    ),
})
