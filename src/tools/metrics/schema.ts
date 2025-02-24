import { z } from 'zod'

export const GetMetricsZodSchema = z.object({
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  query: z
    .string()
    .describe('Datadog metrics query string. e.g. "avg:system.cpu.user{*}'),
})

export type GetMetricsArgs = z.infer<typeof GetMetricsZodSchema>
