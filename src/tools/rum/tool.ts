import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  GetRumEventsZodSchema,
  GetRumApplicationsZodSchema,
  GetRumGroupedEventCountZodSchema,
  GetRumPagePerformanceZodSchema,
  GetRumPageWaterfallZodSchema,
} from './schema'

type RumToolName =
  | 'get_rum_events'
  | 'get_rum_applications'
  | 'get_rum_grouped_event_count'
  | 'get_rum_page_performance'
  | 'get_rum_page_waterfall'
type RumTool = ExtendedTool<RumToolName>

export const RUM_TOOLS: RumTool[] = [
  createToolSchema(
    GetRumApplicationsZodSchema,
    'get_rum_applications',
    'Get all RUM applications in the organization',
  ),
  createToolSchema(
    GetRumEventsZodSchema,
    'get_rum_events',
    'Search and retrieve RUM events from Datadog',
  ),
  createToolSchema(
    GetRumGroupedEventCountZodSchema,
    'get_rum_grouped_event_count',
    'Search, group and count RUM events by a specified dimension',
  ),
  createToolSchema(
    GetRumPagePerformanceZodSchema,
    'get_rum_page_performance',
    'Get page (view) performance metrics from RUM data',
  ),
  createToolSchema(
    GetRumPageWaterfallZodSchema,
    'get_rum_page_waterfall',
    'Retrieve RUM page (view) waterfall data filtered by application name and session ID',
  ),
] as const

type RumToolHandlers = ToolHandlers<RumToolName>

export const createRumToolHandlers = (
  apiInstance: v2.RUMApi,
): RumToolHandlers => ({
  get_rum_applications: async (request) => {
    GetRumApplicationsZodSchema.parse(request.params.arguments)

    const response = await apiInstance.getRUMApplications()

    if (response.data == null) {
      throw new Error('No RUM applications data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `RUM applications: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },

  get_rum_events: async (request) => {
    const { query, from, to, limit } = GetRumEventsZodSchema.parse(
      request.params.arguments,
    )

    const response = await apiInstance.listRUMEvents({
      filterQuery: query,
      filterFrom: new Date(from * 1000),
      filterTo: new Date(to * 1000),
      sort: 'timestamp',
      pageLimit: limit,
    })

    if (response.data == null) {
      throw new Error('No RUM events data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `RUM events data: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },

  get_rum_grouped_event_count: async (request) => {
    const { query, from, to, groupBy } = GetRumGroupedEventCountZodSchema.parse(
      request.params.arguments,
    )

    // For session counts, we need to use a query to count unique sessions
    const response = await apiInstance.listRUMEvents({
      filterQuery: query !== '*' ? query : undefined,
      filterFrom: new Date(from * 1000),
      filterTo: new Date(to * 1000),
      sort: 'timestamp',
      pageLimit: 2000,
    })

    if (response.data == null) {
      throw new Error('No RUM events data returned')
    }

    // Extract session counts grouped by the specified dimension
    const sessions = new Map<string, Set<string>>()

    for (const event of response.data) {
      if (event.attributes?.attributes) {
        // Get the group value (default to 'unknown' if not found)
        let groupValue = 'unknown'

        // Parse the groupBy path (e.g., 'application.id')
        let current = event.attributes.attributes
        const groupPath = groupBy.split('.') as Array<
          keyof typeof event.attributes.attributes
        >
        let foundPath = true

        for (const pathPart of groupPath) {
          if (current[pathPart] !== undefined) {
            current = current[pathPart] as v2.RUMEventAttributes
          } else {
            foundPath = false
            break
          }
        }

        if (foundPath) {
          groupValue = String(current)
        }

        // Get or create the session set for this group
        if (!sessions.has(groupValue)) {
          sessions.set(groupValue, new Set<string>())
        }

        // Add the session ID to the set if it exists
        if (event.attributes.attributes.session?.id) {
          sessions.get(groupValue)?.add(event.attributes.attributes.session.id)
        }
      }
    }

    // Convert the map to an object with counts
    const sessionCounts = Object.fromEntries(
      Array.from(sessions.entries()).map(([key, set]) => [key, set.size]),
    )

    return {
      content: [
        {
          type: 'text',
          text: `Session counts (grouped by ${groupBy}): ${JSON.stringify(sessionCounts)}`,
        },
      ],
    }
  },

  get_rum_page_performance: async (request) => {
    const { query, from, to, metricNames } =
      GetRumPagePerformanceZodSchema.parse(request.params.arguments)

    // Build a query that focuses on view events with performance metrics
    const viewQuery = query !== '*' ? `@type:view ${query}` : '@type:view'

    const response = await apiInstance.listRUMEvents({
      filterQuery: viewQuery,
      filterFrom: new Date(from * 1000),
      filterTo: new Date(to * 1000),
      sort: 'timestamp',
      pageLimit: 2000,
    })

    if (response.data == null) {
      throw new Error('No RUM events data returned')
    }

    // Extract and calculate performance metrics
    const metrics: Record<string, number[]> = {}
    metricNames.forEach((name) => {
      metrics[name] = []
    })

    for (const event of response.data) {
      if (event.attributes?.attributes) {
        // Collect each requested metric if it exists
        for (const metricName of metricNames) {
          // Handle nested properties like 'view.load_time'
          const parts = metricName.split('.') as Array<
            keyof typeof event.attributes.attributes
          >
          let value = event.attributes.attributes

          for (let i = 0; i < parts.length; i++) {
            if (value && value[parts[i]] !== undefined) {
              value = value[parts[i]]
            } else {
              value = {}
              break
            }
          }

          // If we found a numeric value, add it to the metrics
          if (typeof value === 'number') {
            metrics[metricName].push(value)
          }
        }
      }
    }

    // Calculate statistics for each metric
    const results: Record<
      string,
      { avg: number; min: number; max: number; count: number }
    > = {}

    for (const [name, values] of Object.entries(metrics)) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0)
        results[name] = {
          avg: sum / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        }
      } else {
        results[name] = { avg: 0, min: 0, max: 0, count: 0 }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Page performance metrics: ${JSON.stringify(results)}`,
        },
      ],
    }
  },

  get_rum_page_waterfall: async (request) => {
    const { applicationName, sessionId } = GetRumPageWaterfallZodSchema.parse(
      request.params.arguments,
    )

    const response = await apiInstance.listRUMEvents({
      filterQuery: `@application.name:${applicationName} @session.id:${sessionId}`,
      sort: 'timestamp',
      pageLimit: 2000,
    })

    if (response.data == null) {
      throw new Error('No RUM events data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Waterfall data: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },
})
