import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v2 } from '@datadog/datadog-api-client'
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
  config: client.Configuration,
): TracesToolHandlers => {
  const apiInstance = new v2.SpansApi(config)
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
                from: new Date(from * 1000).toISOString(),
                to: new Date(to * 1000).toISOString(),
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
