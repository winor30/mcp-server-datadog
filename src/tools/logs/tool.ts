import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetLogsZodSchema } from './schema'

type LogsToolName = 'get_logs'
type LogsTool = ExtendedTool<LogsToolName>

export const LOGS_TOOLS: LogsTool[] = [
  createToolSchema(
    GetLogsZodSchema,
    'get_logs',
    'Search and retrieve logs from Datadog',
  ),
] as const

type LogsToolHandlers = ToolHandlers<LogsToolName>

export const createLogsToolHandlers = (
  config: client.Configuration,
): LogsToolHandlers => {
  const apiInstance = new v2.LogsApi(config)
  return {
    get_logs: async (request) => {
      const { query, from, to, limit } = GetLogsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listLogs({
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
  }
}
