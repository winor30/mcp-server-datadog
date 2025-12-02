import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { ListTracesZodSchema } from './schema'
import { parseDatetime } from '../../utils/datetime-parser'

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

      // Parse datetime inputs to epoch seconds
      const fromEpoch = parseDatetime(from)
      const toEpoch = parseDatetime(to)

      const response = await apiInstance.listSpans({
        body: {
          data: {
            attributes: {
              filter: {
                query: [
                  query,
                  ...(service ? [`service:${service}`] : []),
                  ...(operation ? [`operation:${operation}`] : []),
                ].join(' '),
                from: new Date(fromEpoch * 1000).toISOString(),
                to: new Date(toEpoch * 1000).toISOString(),
              },
              sort: sort as 'timestamp' | '-timestamp',
              page: { limit },
            },
            type: 'search_request',
          },
        },
      })

      if (!response.data) {
        throw new Error('No traces data returned')
      }

      return {
        content: [
          {
            type: 'text',
            text: `Traces: ${JSON.stringify({
              traces: response.data,
              count: response.data.length,
            })}`,
          },
        ],
      }
    },
  }
}
