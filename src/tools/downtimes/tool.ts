import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  ListDowntimesZodSchema,
  ScheduleDowntimeZodSchema,
  CancelDowntimeZodSchema,
} from './schema'
import { parseDatetime } from '../../utils/datetime-parser'

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
  apiInstance: v1.DowntimesApi,
): DowntimesToolHandlers => {
  return {
    list_downtimes: async (request) => {
      const { currentOnly } = ListDowntimesZodSchema.parse(
        request.params.arguments,
      )

      const res = await apiInstance.listDowntimes({
        currentOnly,
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

      // Parse datetime inputs to epoch seconds if provided
      const startEpoch =
        params.start !== undefined ? parseDatetime(params.start) : undefined
      const endEpoch =
        params.end !== undefined ? parseDatetime(params.end) : undefined
      const untilEpoch =
        params.recurrence?.until !== undefined
          ? parseDatetime(params.recurrence.until)
          : undefined

      // Convert to the format expected by Datadog client
      const downtimeData: v1.Downtime = {
        scope: [params.scope],
        start: startEpoch,
        end: endEpoch,
        message: params.message,
        timezone: params.timezone,
        monitorId: params.monitorId,
        monitorTags: params.monitorTags,
      }

      // Add recurrence configuration if provided
      if (params.recurrence) {
        downtimeData.recurrence = {
          type: params.recurrence.type,
          period: params.recurrence.period,
          weekDays: params.recurrence.weekDays,
          untilDate: untilEpoch,
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
