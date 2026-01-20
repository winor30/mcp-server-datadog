import { z } from 'zod'

export const QueryMetricsZodSchema = z.object({
  from: z
    .number()
    .describe(
      'Start of the queried time period, seconds since the Unix epoch.',
    ),
  to: z
    .number()
    .describe('End of the queried time period, seconds since the Unix epoch.'),
  query: z
    .string()
    .describe('Datadog metrics query string. e.g. "avg:system.cpu.user{*}'),
})

export const SearchMetricsZodSchema = z.object({
  q: z
    .string()
    .describe(
      'Query string to search metrics upon. Can optionally be prefixed with "metrics:". e.g. "system.cpu"',
    ),
})

export const ListActiveMetricsZodSchema = z.object({
  from: z
    .number()
    .describe(
      'Seconds since the Unix epoch. List metrics that have been active since this time.',
    ),
  host: z
    .string()
    .optional()
    .describe(
      'Hostname for filtering the list of metrics returned. If set, metrics retrieved are those with the corresponding hostname tag.',
    ),
  tagFilter: z
    .string()
    .optional()
    .describe(
      'Filter metrics that have been submitted with the given tags. Supports boolean and wildcard expressions. Cannot be combined with other filters.',
    ),
})

export const GetMetricMetadataZodSchema = z.object({
  metricName: z
    .string()
    .describe('Name of the metric for which to get metadata.'),
})

export const ListTagsByMetricZodSchema = z.object({
  metricName: z
    .string()
    .describe('The name of the metric to get tag key-value pairs for.'),
})

export type QueryMetricsArgs = z.infer<typeof QueryMetricsZodSchema>
export type SearchMetricsArgs = z.infer<typeof SearchMetricsZodSchema>
export type ListActiveMetricsArgs = z.infer<typeof ListActiveMetricsZodSchema>
export type GetMetricMetadataArgs = z.infer<typeof GetMetricMetadataZodSchema>
export type ListTagsByMetricArgs = z.infer<typeof ListTagsByMetricZodSchema>
