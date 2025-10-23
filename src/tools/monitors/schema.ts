import { z } from 'zod'

export const GetMonitorsZodSchema = z.object({
  groupStates: z
    .array(z.enum(['alert', 'warn', 'no data', 'ok']))
    .optional()
    .describe('Filter monitors by their states'),
  name: z.string().optional().describe('Filter monitors by name'),
  tags: z.array(z.string()).optional().describe('Filter monitors by tags'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Limit the number of monitors returned (max 100)'),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe('Page number for pagination'),
  compact: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return compact monitor information instead of full details'),
  id: z.number().int().optional().describe('Retrieve a specific monitor by ID'),
})

export const GetMonitorEventZodSchema = z.object({
  monitorId: z.number().int().describe('The ID of the monitor'),
  eventId: z.string().describe('The event ID string from Datadog'),
  from: z
    .number()
    .int()
    .optional()
    .describe('Start timestamp (Unix time in seconds)'),
  to: z
    .number()
    .int()
    .optional()
    .describe('End timestamp (Unix time in seconds)'),
})
