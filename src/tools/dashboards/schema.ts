import { z } from 'zod'

export const ListDashboardsZodSchema = z.object({
  name: z.string().optional().describe('Filter dashboards by name'),
  tags: z.array(z.string()).optional().describe('Filter dashboards by tags'),
})

export const GetDashboardZodSchema = z.object({
  dashboardId: z.string(),
})
