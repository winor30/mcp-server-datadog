import { v2 } from '@datadog/datadog-api-client'
import { log } from '../../utils/helper'
import { createToolSchema } from '../../utils/tool'
import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { GetAllServicesZodSchema, GetLogsZodSchema } from './schema'

type LogsToolName = 'get_logs' | 'get_all_services'
type LogsTool = ExtendedTool<LogsToolName>

// Storage tier configuration from environment
const SUPPORTED_STORAGE_TIERS = ['indexes', 'online-archives', 'flex'] as const
type StorageTier = (typeof SUPPORTED_STORAGE_TIERS)[number]

function getConfiguredStorageTier(): StorageTier | undefined {
  const value = process.env.DATADOG_STORAGE_TIER
  if (!value) {
    return undefined
  }

  const normalized = value.toLowerCase()
  if (!SUPPORTED_STORAGE_TIERS.includes(normalized as StorageTier)) {
    log(
      'error',
      `Invalid DATADOG_STORAGE_TIER="${value}". Supported values: ${SUPPORTED_STORAGE_TIERS.join(
        ', ',
      )}`,
    )
    return undefined
  }

  return normalized as StorageTier
}

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

export const createLogsToolHandlers = (
  apiInstance: v2.LogsApi,
): LogsToolHandlers => ({
  get_logs: async (request) => {
    const { query, from, to, limit } = GetLogsZodSchema.parse(
      request.params.arguments,
    )

    const configuredStorageTier = getConfiguredStorageTier()
    const filter: {
      query: string
      from: string
      to: string
      storageTier?: string
    } = {
      query,
      // `from` and `to` are in epoch seconds, but the Datadog API expects milliseconds
      from: `${from * 1000}`,
      to: `${to * 1000}`,
    }

    // Add storageTier to filter if configured
    if (configuredStorageTier) {
      filter.storageTier = configuredStorageTier
    }

    const unlimited = limit === 0
    const allLogs: v2.Log[] = []
    let cursor: string | undefined

    while (unlimited || allLogs.length < limit) {
      const pageLimit = unlimited
        ? 1000
        : Math.min(limit - allLogs.length, 1000)
      const response = await apiInstance.listLogs({
        body: {
          filter,
          page: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
          sort: '-timestamp',
        },
      })

      if (!response.data || response.data.length === 0) {
        break
      }

      allLogs.push(...response.data)

      cursor = response.meta?.page?.after
      if (!cursor) {
        break
      }
    }

    if (allLogs.length === 0) {
      throw new Error('No logs data returned')
    }

    const result = unlimited ? allLogs : allLogs.slice(0, limit)

    return {
      content: [
        {
          type: 'text',
          text: `Logs data: ${JSON.stringify(result)}`,
        },
      ],
    }
  },

  get_all_services: async (request) => {
    const { query, from, to, limit } = GetAllServicesZodSchema.parse(
      request.params.arguments,
    )

    const configuredStorageTier = getConfiguredStorageTier()
    const filter: {
      query: string
      from: string
      to: string
      storageTier?: string
    } = {
      query,
      // `from` and `to` are in epoch seconds, but the Datadog API expects milliseconds
      from: `${from * 1000}`,
      to: `${to * 1000}`,
    }

    // Add storageTier to filter if configured
    if (configuredStorageTier) {
      filter.storageTier = configuredStorageTier
    }

    const unlimited = limit === 0
    const services = new Set<string>()
    let cursor: string | undefined
    let totalLogsProcessed = 0

    while (unlimited || totalLogsProcessed < limit) {
      const pageLimit = unlimited
        ? 1000
        : Math.min(limit - totalLogsProcessed, 1000)
      const response = await apiInstance.listLogs({
        body: {
          filter,
          page: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
          sort: '-timestamp',
        },
      })

      if (!response.data || response.data.length === 0) {
        break
      }

      for (const logEntry of response.data) {
        if (logEntry.attributes && logEntry.attributes.service) {
          services.add(logEntry.attributes.service)
        }
      }

      totalLogsProcessed += response.data.length

      cursor = response.meta?.page?.after
      if (!cursor) {
        break
      }
    }

    if (services.size === 0) {
      throw new Error('No logs data returned')
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
