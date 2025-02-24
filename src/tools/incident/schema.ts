import { z } from 'zod'

export const ListIncidentsZodSchema = z.object({
  pageSize: z.number().min(1).max(100).default(10),
  pageOffset: z.number().min(0).default(0),
})

export const GetIncidentZodSchema = z.object({
  incidentId: z.string().nonempty(),
})

export type ListIncidentsArgs = z.infer<typeof ListIncidentsZodSchema>
export type GetIncidentArgs = z.infer<typeof GetIncidentZodSchema>
