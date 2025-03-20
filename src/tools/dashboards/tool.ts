import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetDashboardZodSchema, ListDashboardsZodSchema } from './schema'

type DashboardsToolName = 'list_dashboards' | 'get_dashboard'
type DashboardsTool = ExtendedTool<DashboardsToolName>

export const DASHBOARDS_TOOLS: DashboardsTool[] = [
  createToolSchema(
    ListDashboardsZodSchema,
    'list_dashboards',
    'Get list of dashboards from Datadog',
  ),
  createToolSchema(
    GetDashboardZodSchema,
    'get_dashboard',
    'Get a dashboard from Datadog',
  ),
] as const

type DashboardsToolHandlers = ToolHandlers<DashboardsToolName>

export const createDashboardsToolHandlers = (
  apiInstance: v1.DashboardsApi,
): DashboardsToolHandlers => {
  return {
    list_dashboards: async (request) => {
      const { name, tags } = ListDashboardsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listDashboards({
        filterShared: false,
      })

      if (!response.dashboards) {
        throw new Error('No dashboards data returned')
      }

      // Filter dashboards based on name and tags if provided
      let filteredDashboards = response.dashboards
      if (name) {
        const searchTerm = name.toLowerCase()
        filteredDashboards = filteredDashboards.filter((dashboard) =>
          dashboard.title?.toLowerCase().includes(searchTerm),
        )
      }
      if (tags && tags.length > 0) {
        filteredDashboards = filteredDashboards.filter((dashboard) => {
          const dashboardTags = dashboard.description?.split(',') || []
          return tags.every((tag) => dashboardTags.includes(tag))
        })
      }

      const dashboards = filteredDashboards.map((dashboard) => ({
        ...dashboard,
        url: `https://app.datadoghq.com/dashboard/${dashboard.id}`,
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Dashboards: ${JSON.stringify(dashboards)}`,
          },
        ],
      }
    },
    get_dashboard: async (request) => {
      const { dashboardId } = GetDashboardZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getDashboard({
        dashboardId,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Dashboard: ${JSON.stringify(response)}`,
          },
        ],
      }
    },
  }
}
