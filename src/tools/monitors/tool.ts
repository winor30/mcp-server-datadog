import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetMonitorsZodSchema } from './schema'
import { unreachable } from '../../utils/helper'
import { UnparsedObject } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-common/util.js'

type MonitorsToolName = 'get_monitors'
type MonitorsTool = ExtendedTool<MonitorsToolName>

export const MONITORS_TOOLS: MonitorsTool[] = [
  createToolSchema(
    GetMonitorsZodSchema,
    'get_monitors',
    'Get monitors status from Datadog',
  ),
] as const

type MonitorsToolHandlers = ToolHandlers<MonitorsToolName>

export const createMonitorsToolHandlers = (
  config: client.Configuration,
): MonitorsToolHandlers => {
  const apiInstance = new v1.MonitorsApi(config)
  return {
    get_monitors: async (request) => {
      const { groupStates, name, tags } = GetMonitorsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listMonitors({
        groupStates: groupStates?.join(','),
        name,
        tags: tags?.join(','),
      })

      if (response == null) {
        throw new Error('No monitors data returned')
      }

      const monitors = response.map((monitor) => ({
        name: monitor.name || '',
        id: monitor.id || 0,
        status: (monitor.overallState as string) || 'unknown',
        message: monitor.message,
        tags: monitor.tags || [],
        query: monitor.query || '',
        lastUpdatedTs: monitor.modified
          ? Math.floor(new Date(monitor.modified).getTime() / 1000)
          : undefined,
      }))

      // Calculate summary
      const summary = response.reduce(
        (acc, monitor) => {
          const status = monitor.overallState
          if (status == null || status instanceof UnparsedObject) {
            return acc
          }

          switch (status) {
            case 'Alert':
              acc.alert++
              break
            case 'Warn':
              acc.warn++
              break
            case 'No Data':
              acc.noData++
              break
            case 'OK':
              acc.ok++
              break
            case 'Ignored':
              acc.ignored++
              break
            case 'Skipped':
              acc.skipped++
              break
            case 'Unknown':
              acc.unknown++
              break
            default:
              unreachable(status)
          }
          return acc
        },
        {
          alert: 0,
          warn: 0,
          noData: 0,
          ok: 0,
          ignored: 0,
          skipped: 0,
          unknown: 0,
        },
      )

      return {
        content: [
          {
            type: 'text',
            text: `Monitors: ${JSON.stringify(monitors)}`,
          },
          {
            type: 'text',
            text: `Summary of monitors: ${JSON.stringify(summary)}`,
          },
        ],
      }
    },
  }
}
