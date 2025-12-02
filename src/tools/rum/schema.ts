import { z } from 'zod'
import { DATETIME_DESCRIPTION } from '../../utils/datetime-parser'

/**
 * Schema for retrieving RUM events.
 * Defines parameters for querying RUM events within a time window.
 *
 * @param query - Datadog RUM query string
 * @param from - Start time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param to - End time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param limit - Maximum number of events to return (default: 100)
 */
export const GetRumEventsZodSchema = z.object({
  query: z.string().default('').describe('Datadog RUM query string'),
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
    .describe('Maximum number of events to return. Default is 100.'),
})

/**
 * Schema for retrieving RUM applications.
 * Returns a list of all RUM applications in the organization.
 */
export const GetRumApplicationsZodSchema = z.object({})

/**
 * Schema for retrieving unique user session counts.
 * Defines parameters for querying session counts within a time window.
 *
 * @param query - Optional. Additional query filter for RUM search. Defaults to "*" (all events)
 * @param from - Start time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param to - End time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param groupBy - Optional. Dimension to group results by (e.g., 'application.name')
 */
export const GetRumGroupedEventCountZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for RUM search'),
  from: z
    .union([z.number(), z.string()])
    .describe(`Start time. ${DATETIME_DESCRIPTION}`),
  to: z
    .union([z.number(), z.string()])
    .describe(`End time. ${DATETIME_DESCRIPTION}`),
  groupBy: z
    .string()
    .optional()
    .default('application.name')
    .describe('Dimension to group results by. Default is application.name'),
})

/**
 * Schema for retrieving page performance metrics.
 * Defines parameters for querying performance metrics within a time window.
 *
 * @param query - Optional. Additional query filter for RUM search. Defaults to "*" (all events)
 * @param from - Start time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param to - End time (epoch seconds, relative time, ISO 8601, or shortcut)
 * @param metricNames - Array of metric names to retrieve (e.g., 'view.load_time', 'view.first_contentful_paint')
 */
export const GetRumPagePerformanceZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for RUM search'),
  from: z
    .union([z.number(), z.string()])
    .describe(`Start time. ${DATETIME_DESCRIPTION}`),
  to: z
    .union([z.number(), z.string()])
    .describe(`End time. ${DATETIME_DESCRIPTION}`),
  metricNames: z
    .array(z.string())
    .default([
      'view.load_time',
      'view.first_contentful_paint',
      'view.largest_contentful_paint',
    ])
    .describe('Array of metric names to retrieve'),
})

/**
 * Schema for retrieving RUM page waterfall data.
 * Defines parameters for querying waterfall data within a time window.
 *
 * @param application - Application name or ID to filter events
 * @param sessionId - Session ID to filter events
 */
export const GetRumPageWaterfallZodSchema = z.object({
  applicationName: z.string().describe('Application name to filter events'),
  sessionId: z.string().describe('Session ID to filter events'),
})
