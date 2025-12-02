import { z } from 'zod'
import { DATETIME_DESCRIPTION } from '../../utils/datetime-parser'

export const ListTracesZodSchema = z.object({
  query: z.string().describe('Datadog APM trace query string'),
  from: z
    .union([z.number(), z.string()])
    .describe(`Start time. ${DATETIME_DESCRIPTION}`),
  to: z
    .union([z.number(), z.string()])
    .describe(`End time. ${DATETIME_DESCRIPTION}`),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of traces to return'),
  sort: z
    .enum(['timestamp', '-timestamp'])
    .optional()
    .default('-timestamp')
    .describe('Sort order for traces'),
  service: z.string().optional().describe('Filter by service name'),
  operation: z.string().optional().describe('Filter by operation name'),
})

export type ListTracesArgs = z.infer<typeof ListTracesZodSchema>
