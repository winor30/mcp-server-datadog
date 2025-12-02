import { z } from 'zod'
import { DATETIME_DESCRIPTION } from '../../utils/datetime-parser'

export const QueryMetricsZodSchema = z.object({
  from: z
    .union([z.number(), z.string()])
    .describe(`Start of the queried time period. ${DATETIME_DESCRIPTION}`),
  to: z
    .union([z.number(), z.string()])
    .describe(`End of the queried time period. ${DATETIME_DESCRIPTION}`),
  query: z
    .string()
    .describe('Datadog metrics query string. e.g. "avg:system.cpu.user{*}'),
})

export type QueryMetricsArgs = z.infer<typeof QueryMetricsZodSchema>
