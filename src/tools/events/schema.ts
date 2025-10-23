import { z } from 'zod'

/**
 * Schema for listing events from Datadog event stream.
 * This allows searching and browsing events to assist with root cause analysis.
 *
 * @param start - Start time for the event stream query (POSIX timestamp)
 * @param end - End time for the event stream query (POSIX timestamp)
 * @param priority - Filter by event priority (normal or low)
 * @param sources - Filter by event sources (e.g., nagios, hudson, jenkins, my_apps)
 * @param tags - Filter events by tags
 * @param unaggregated - Return all events (not just aggregated events)
 * @param excludeAggregate - Don't aggregate events in the output
 * @param page - Page number for pagination
 * @param limit - Maximum number of events to return per page
 */
export const ListEventsZodSchema = z.object({
  start: z.number().int().describe('Start time in epoch seconds'),
  end: z.number().int().describe('End time in epoch seconds'),
  priority: z
    .enum(['normal', 'low'])
    .optional()
    .describe('Filter by event priority'),
  sources: z
    .array(z.string())
    .optional()
    .describe('Filter by event sources (e.g., nagios, jenkins, my_apps)'),
  tags: z.array(z.string()).optional().describe('Filter events by tags'),
  unaggregated: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return all events (not just aggregated events)'),
  excludeAggregate: z
    .boolean()
    .optional()
    .default(false)
    .describe("Don't aggregate events in the output"),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe('Page number for pagination'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(30)
    .describe('Maximum number of events to return per page (max 100)'),
})

/**
 * Schema for retrieving a specific event by ID.
 * This allows getting the full details of an event.
 *
 * @param eventId - The ID of the event to retrieve
 */
export const GetEventZodSchema = z.object({
  eventId: z.number().int().describe('The ID of the event to retrieve'),
})

/**
 * Schema for posting a new event to the event stream.
 * This allows creating custom events for important operational changes.
 *
 * @param title - The title of the event
 * @param text - The text body of the event
 * @param dateHappened - The timestamp when the event occurred (POSIX timestamp)
 * @param priority - The priority of the event
 * @param host - The host name to associate with the event
 * @param tags - A list of tags to apply to the event
 * @param alertType - The type of alert (error, warning, info, success)
 * @param aggregationKey - Key for aggregating events
 * @param sourceTypeName - The source type name
 * @param relatedEventId - ID of the related event
 * @param deviceName - The device name
 */
export const CreateEventZodSchema = z.object({
  title: z.string().describe('The title of the event'),
  text: z.string().describe('The text body of the event'),
  dateHappened: z
    .number()
    .int()
    .optional()
    .describe('The timestamp when the event occurred (POSIX timestamp)'),
  priority: z
    .enum(['normal', 'low'])
    .optional()
    .default('normal')
    .describe('The priority of the event'),
  host: z
    .string()
    .optional()
    .describe('The host name to associate with the event'),
  tags: z
    .array(z.string())
    .optional()
    .describe('A list of tags to apply to the event'),
  alertType: z
    .enum(['error', 'warning', 'info', 'success'])
    .optional()
    .default('info')
    .describe('The type of alert'),
  aggregationKey: z.string().optional().describe('Key for aggregating events'),
  sourceTypeName: z.string().optional().describe('The source type name'),
  relatedEventId: z
    .number()
    .int()
    .optional()
    .describe('ID of the related event'),
  deviceName: z.string().optional().describe('The device name'),
})

export type ListEventsArgs = z.infer<typeof ListEventsZodSchema>
export type GetEventArgs = z.infer<typeof GetEventZodSchema>
export type CreateEventArgs = z.infer<typeof CreateEventZodSchema>
