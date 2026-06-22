import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { ListAuditLogsZodSchema, SearchAuditLogsZodSchema } from './schema'

type AuditToolName = 'list_audit_logs' | 'search_audit_logs'
type AuditTool = ExtendedTool<AuditToolName>

export const AUDIT_TOOLS: AuditTool[] = [
  createToolSchema(
    ListAuditLogsZodSchema,
    'list_audit_logs',
    'List audit log events from Datadog with simple filtering',
  ),
  createToolSchema(
    SearchAuditLogsZodSchema,
    'search_audit_logs',
    'Search audit log events from Datadog with structured query and sorting',
  ),
] as const

type AuditToolHandlers = ToolHandlers<AuditToolName>

export const createAuditToolHandlers = (
  apiInstance: v2.AuditApi,
): AuditToolHandlers => ({
  list_audit_logs: async (request) => {
    const { query, from, to, limit } = ListAuditLogsZodSchema.parse(
      request.params.arguments,
    )

    const unlimited = limit === 0
    const allEvents: v2.AuditLogsEvent[] = []
    let cursor: string | undefined

    while (unlimited || allEvents.length < limit) {
      const pageLimit = unlimited
        ? 1000
        : Math.min(limit - allEvents.length, 1000)
      const response = await apiInstance.listAuditLogs({
        filterQuery: query,
        filterFrom: new Date(from * 1000),
        filterTo: new Date(to * 1000),
        pageLimit,
        ...(cursor ? { pageCursor: cursor } : {}),
      })

      if (!response.data || response.data.length === 0) {
        break
      }

      allEvents.push(...response.data)

      cursor = response.meta?.page?.after
      if (!cursor) {
        break
      }
    }

    if (allEvents.length === 0) {
      throw new Error('No audit log data returned')
    }

    const result = unlimited ? allEvents : allEvents.slice(0, limit)

    return {
      content: [
        {
          type: 'text',
          text: `Audit logs: ${JSON.stringify(result)}`,
        },
      ],
    }
  },

  search_audit_logs: async (request) => {
    const { query, from, to, limit, sort } = SearchAuditLogsZodSchema.parse(
      request.params.arguments,
    )

    const unlimited = limit === 0
    const allEvents: v2.AuditLogsEvent[] = []
    let cursor: string | undefined

    while (unlimited || allEvents.length < limit) {
      const pageLimit = unlimited
        ? 1000
        : Math.min(limit - allEvents.length, 1000)
      const response = await apiInstance.searchAuditLogs({
        body: {
          filter: {
            query,
            from: new Date(from * 1000).toISOString(),
            to: new Date(to * 1000).toISOString(),
          },
          page: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
          sort: sort as v2.AuditLogsSort,
        },
      })

      if (!response.data || response.data.length === 0) {
        break
      }

      allEvents.push(...response.data)

      cursor = response.meta?.page?.after
      if (!cursor) {
        break
      }
    }

    if (allEvents.length === 0) {
      throw new Error('No audit log data returned')
    }

    const result = unlimited ? allEvents : allEvents.slice(0, limit)

    return {
      content: [
        {
          type: 'text',
          text: `Audit logs: ${JSON.stringify(result)}`,
        },
      ],
    }
  },
})
