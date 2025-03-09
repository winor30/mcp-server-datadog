import { z } from 'zod'

export const ListDowntimesZodSchema = z.object({
  currentOnly: z.boolean().optional(),
})

export const ScheduleDowntimeZodSchema = z.object({
  scope: z.string().nonempty(), // example: 'host:my-host'
  start: z.number().optional(), // UNIX timestamp
  end: z.number().optional(), // UNIX timestamp
  message: z.string().optional(),
  timezone: z.string().optional(), // example: 'UTC', 'America/New_York'
  monitorId: z.number().optional(),
  monitorTags: z.array(z.string()).optional(),
  recurrence: z
    .object({
      type: z.enum(['days', 'weeks', 'months', 'years']),
      period: z.number().min(1),
      weekDays: z
        .array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))
        .optional(),
      until: z.number().optional(), // UNIX timestamp
    })
    .optional(),
})

export const CancelDowntimeZodSchema = z.object({
  downtimeId: z.number(),
})
