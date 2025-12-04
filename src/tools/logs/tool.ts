import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetLogsZodSchema, GetAllServicesZodSchema } from './schema'

type LogsToolName = 'get_logs' | 'get_all_services'
type LogsTool = ExtendedTool<LogsToolName>

export const LOGS_TOOLS: LogsTool[] = [
  createToolSchema(
    GetLogsZodSchema,
    'get_logs',
    'Search and retrieve logs from Datadog',
  ),
  createToolSchema(
    GetAllServicesZodSchema,
    'get_all_services',
    'Extract all unique service names from logs',
  ),
] as const

type LogsToolHandlers = ToolHandlers<LogsToolName>

/**
 * Validates timestamp parameters to prevent common errors
 * @throws Error if timestamps are invalid
 */
function validateTimestamps(from: number, to: number): void {
  const now = Math.floor(Date.now() / 1000) // Current time in epoch seconds
  const futureBuffer = 300 // Allow 5 minutes buffer for clock skew

  // Check if timestamps are valid numbers
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error('Invalid timestamps: from and to must be valid numbers')
  }

  // Check if 'from' is before 'to'
  if (from >= to) {
    throw new Error(
      `Invalid time range: 'from' (${new Date(from * 1000).toISOString()}) must be before 'to' (${new Date(to * 1000).toISOString()})`,
    )
  }

  // Check if timestamps are in the future (with buffer for clock skew)
  if (from > now + futureBuffer) {
    throw new Error(
      `Invalid 'from' timestamp: ${new Date(from * 1000).toISOString()} is in the future. Current time: ${new Date(now * 1000).toISOString()}. Please check your timestamp calculation.`,
    )
  }

  if (to > now + futureBuffer) {
    throw new Error(
      `Invalid 'to' timestamp: ${new Date(to * 1000).toISOString()} is in the future. Current time: ${new Date(now * 1000).toISOString()}. Please check your timestamp calculation.`,
    )
  }

  // Warn if timestamps are very old (more than 1 year ago)
  const oneYearAgo = now - 31536000 // 365 days in seconds
  if (to < oneYearAgo) {
    console.warn(
      `Warning: Querying very old logs. 'to' timestamp is ${new Date(to * 1000).toISOString()}, which is more than 1 year ago.`,
    )
  }
}

export const createLogsToolHandlers = (
  apiInstance: v2.LogsApi,
): LogsToolHandlers => ({
  get_logs: async (request) => {
    const { query, from, to, limit } = GetLogsZodSchema.parse(
      request.params.arguments,
    )

    // Validate timestamps before making the API call
    validateTimestamps(from, to)

    const fromISO = new Date(from * 1000).toISOString()
    const toISO = new Date(to * 1000).toISOString()

    const response = await apiInstance.listLogs({
      body: {
        filter: {
          query,
          from: fromISO,
          to: toISO,
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

  get_all_services: async (request) => {
    const { query, from, to, limit } = GetAllServicesZodSchema.parse(
      request.params.arguments,
    )

    // Validate timestamps before making the API call
    validateTimestamps(from, to)

    const fromISO = new Date(from * 1000).toISOString()
    const toISO = new Date(to * 1000).toISOString()

    const response = await apiInstance.listLogs({
      body: {
        filter: {
          query,
          from: fromISO,
          to: toISO,
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

    // Extract unique services from logs
    const services = new Set<string>()

    for (const log of response.data) {
      // Access service attribute from logs based on the Datadog API structure
      if (log.attributes && log.attributes.service) {
        services.add(log.attributes.service)
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Services: ${JSON.stringify(Array.from(services).sort())}`,
        },
      ],
    }
  },
})
