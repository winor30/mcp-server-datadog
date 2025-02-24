import { z } from 'zod'

export const GetMonitorsZodSchema = z.object({
  groupStates: z
    .array(z.enum(['alert', 'warn', 'no data', 'ok']))
    .optional()
    .describe('Filter monitors by their states'),
  name: z.string().optional().describe('Filter monitors by name'),
  tags: z.array(z.string()).optional().describe('Filter monitors by tags'),
})
