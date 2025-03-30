import { z } from 'zod'

export const GetLogsZodSchema = z.object({
  query: z.string().default('').describe('Datadog logs query string'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of logs to return. Default is 100.'),
})

/**
 * Schema for retrieving all unique service names from logs.
 * Defines parameters for querying logs within a time window.
 *
 * @param query - Optional. Additional query filter for log search. Defaults to "*" (all logs)
 * @param from - Required. Start time in epoch seconds
 * @param to - Required. End time in epoch seconds
 * @param limit - Optional. Maximum number of logs to search through. Default is 1000.
 */
export const GetAllServicesZodSchema = z.object({
  query: z.string().default('*').describe('Optional query filter for log search'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(1000)
    .describe('Maximum number of logs to search through. Default is 1000.'),
})
