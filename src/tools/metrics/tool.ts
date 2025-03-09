import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetMetricsZodSchema } from './schema'

type MetricsToolName = 'get_metrics'
type MetricsTool = ExtendedTool<MetricsToolName>

export const METRICS_TOOLS: MetricsTool[] = [
  createToolSchema(
    GetMetricsZodSchema,
    'get_metrics',
    'Get metrics data from Datadog',
  ),
] as const

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const createMetricsToolHandlers = (
  apiInstance: v1.MetricsApi,
): MetricsToolHandlers => {
  return {
    get_metrics: async (request) => {
      const { from, to, query } = GetMetricsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.queryMetrics({
        from,
        to,
        query,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Metrics data: ${JSON.stringify({ response })}`,
          },
        ],
      }
    },
  }
}
