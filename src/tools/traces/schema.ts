import { z } from 'zod'

export const ListTracesZodSchema = z.object({
  query: z.string().describe('Datadog APM trace query string'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
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
