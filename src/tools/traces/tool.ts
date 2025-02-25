import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { datadogConfig as config } from '../../utils/datadog'
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

const API_INSTANCE = new v2.SpansApi(config)

type TracesToolHandlers = ToolHandlers<TracesToolName>

export const TRACES_HANDLERS: TracesToolHandlers = {
  list_traces: async (request) => {
    const {
      query,
      from,
      to,
      limit = 100,
      sort = '-timestamp',
      service,
      operation,
    } = request.params.arguments as {
      query: string
      from: number
      to: number
      limit?: number
      sort?: string
      service?: string
      operation?: string
    }

    const response = await API_INSTANCE.listSpans({
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
} as const
