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

    const response = await apiInstance.listAuditLogs({
      filterQuery: query,
      filterFrom: new Date(from * 1000),
      filterTo: new Date(to * 1000),
      pageLimit: limit,
    })

    if (response.data == null) {
      throw new Error('No audit log data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Audit logs: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },

  search_audit_logs: async (request) => {
    const { query, from, to, limit, sort } = SearchAuditLogsZodSchema.parse(
      request.params.arguments,
    )

    const response = await apiInstance.searchAuditLogs({
      body: {
        filter: {
          query,
          from: new Date(from * 1000).toISOString(),
          to: new Date(to * 1000).toISOString(),
        },
        page: {
          limit,
        },
        sort: sort as v2.AuditLogsSort,
      },
    })

    if (response.data == null) {
      throw new Error('No audit log data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Audit logs: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },
})
