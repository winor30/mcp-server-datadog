import { z } from 'zod'

export const GetLogsZodSchema = z.object({
  query: z.string().describe('Datadog logs query string'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of logs to return. Default is 100.'),
})
