import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { ListTracesZodSchema } from './schema'

type TracesToolName = 'list_traces'
type TracesTool = ExtendedTool<TracesToolName>

export const TRACES_TOOLS: TracesTool[] = [
  createToolSchema(
    ListTracesZodSchema,
    'list_traces',
    'Get APM traces from Datadog',
  ),
] as const

type TracesToolHandlers = ToolHandlers<TracesToolName>

export const createTracesToolHandlers = (
  apiInstance: v2.SpansApi,
): TracesToolHandlers => {
  return {
    list_traces: async (request) => {
      const {
        query,
        from,
        to,
        limit = 100,
        sort = '-timestamp',
        service,
        operation,
      } = ListTracesZodSchema.parse(request.params.arguments)

      const filterQuery = [
        query,
        ...(service ? [`service:${service}`] : []),
        ...(operation ? [`operation:${operation}`] : []),
      ].join(' ')

      const filterObj = {
        query: filterQuery,
        from: new Date(from * 1000).toISOString(),
        to: new Date(to * 1000).toISOString(),
      }

      const unlimited = limit === 0
      const allSpans: v2.Span[] = []
      let cursor: string | undefined

      while (unlimited || allSpans.length < limit) {
        const pageLimit = unlimited
          ? 1000
          : Math.min(limit - allSpans.length, 1000)
        const response = await apiInstance.listSpans({
          body: {
            data: {
              attributes: {
                filter: filterObj,
                sort: sort as 'timestamp' | '-timestamp',
                page: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
              },
              type: 'search_request',
            },
          },
        })

        if (!response.data || response.data.length === 0) {
          break
        }

        allSpans.push(...response.data)

        cursor = response.meta?.page?.after
        if (!cursor) {
          break
        }
      }

      if (allSpans.length === 0) {
        throw new Error('No traces data returned')
      }

      const result = unlimited ? allSpans : allSpans.slice(0, limit)

      return {
        content: [
          {
            type: 'text',
            text: `Traces: ${JSON.stringify({
              traces: result,
              count: result.length,
            })}`,
          },
        ],
      }
    },
  }
}
