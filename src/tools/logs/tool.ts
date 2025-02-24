import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetLogsZodSchema } from './schema'
import { datadogConfig } from '../../utils/datadog'

type LogsToolName = 'get_logs'
type LogsTool = ExtendedTool<LogsToolName>

export const LOGS_TOOLS: LogsTool[] = [
  createToolSchema(
    GetLogsZodSchema,
    'get_logs',
    'Search and retrieve logs from Datadog',
  ),
] as const

const API_INSTANCE = new v2.LogsApi(datadogConfig)

type LogsToolHandlers = ToolHandlers<LogsToolName>

export const LOGS_HANDLERS: LogsToolHandlers = {
  get_logs: async (request) => {
    const { query, from, to, limit } = GetLogsZodSchema.parse(
      request.params.arguments,
    )

    const response = await API_INSTANCE.listLogs({
      body: {
        filter: {
          query,
          // `from` and `to` are in epoch seconds, but the Datadog API expects milliseconds
          from: `${from * 1000}`,
          to: `${to * 1000}`,
        },
        page: {
          limit,
        },
        sort: '-timestamp',
      },
    })

    if (response.data == null) {
      throw new Error('No logs data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Logs data: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },
} as const
