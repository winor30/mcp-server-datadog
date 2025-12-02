import { z } from 'zod'
import { DATETIME_DESCRIPTION } from '../../utils/datetime-parser'

export const GetLogsZodSchema = z.object({
  query: z.string().default('').describe('Datadog logs query string'),
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
    .describe('Maximum number of logs to return. Default is 100.'),
})

/**
 * Schema for retrieving all unique service names from logs.
 * Defines parameters for querying logs within a time window.
 *
 * @param query - Optional. Additional query filter for log search. Defaults to "*" (all logs)
 * @param from - Required. Start time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param to - Required. End time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param limit - Optional. Maximum number of logs to search through. Default is 1000.
 */
export const GetAllServicesZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for log search'),
  from: z
    .union([z.number(), z.string()])
    .describe(`Start time. ${DATETIME_DESCRIPTION}`),
  to: z
    .union([z.number(), z.string()])
    .describe(`End time. ${DATETIME_DESCRIPTION}`),
  limit: z
    .number()
    .optional()
    .default(1000)
    .describe('Maximum number of logs to search through. Default is 1000.'),
})
