import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  ListDowntimesZodSchema,
  ScheduleDowntimeZodSchema,
  CancelDowntimeZodSchema,
} from './schema'

type DowntimesToolName =
  | 'list_downtimes'
  | 'schedule_downtime'
  | 'cancel_downtime'
type DowntimesTool = ExtendedTool<DowntimesToolName>

export const DOWNTIMES_TOOLS: DowntimesTool[] = [
  createToolSchema(
    ListDowntimesZodSchema,
    'list_downtimes',
    'List scheduled downtimes from Datadog',
  ),
  createToolSchema(
    ScheduleDowntimeZodSchema,
    'schedule_downtime',
    'Schedule a downtime in Datadog',
  ),
  createToolSchema(
    CancelDowntimeZodSchema,
    'cancel_downtime',
    'Cancel a scheduled downtime in Datadog',
  ),
] as const

type DowntimesToolHandlers = ToolHandlers<DowntimesToolName>

export const createDowntimesToolHandlers = (
  config: client.Configuration,
): DowntimesToolHandlers => {
  const apiInstance = new v1.DowntimesApi(config)

  return {
    list_downtimes: async (request) => {
      const { currentOnly, monitorId } = ListDowntimesZodSchema.parse(
        request.params.arguments,
      )

      const res = await apiInstance.listDowntimes({
        currentOnly,
        monitorId,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Listed downtimes:\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      }
    },

    schedule_downtime: async (request) => {
      const params = ScheduleDowntimeZodSchema.parse(request.params.arguments)

      // Convert to the format expected by Datadog client
      const downtimeData: v1.Downtime = {
        scope: params.scope,
        start: params.start,
        end: params.end,
        message: params.message,
        timezone: params.timezone,
        monitorId: params.monitorId,
        monitor_tags: params.monitorTags,
      }

      // Add recurrence configuration if provided
      if (params.recurrence) {
        downtimeData.recurrence = {
          type: params.recurrence.type,
          period: params.recurrence.period,
          week_days: params.recurrence.weekDays,
          until: params.recurrence.until,
        }
      }

      const res = await apiInstance.createDowntime({
        body: downtimeData,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Scheduled downtime: ${JSON.stringify(res, null, 2)}`,
          },
        ],
      }
    },

    cancel_downtime: async (request) => {
      const { downtimeId } = CancelDowntimeZodSchema.parse(
        request.params.arguments,
      )

      await apiInstance.cancelDowntime({
        downtimeId,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Cancelled downtime with ID: ${downtimeId}`,
          },
        ],
      }
    },
  }
}
