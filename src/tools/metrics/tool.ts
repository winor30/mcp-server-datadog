import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetMetricsZodSchema } from './schema'
import { datadogConfig } from '../../utils/datadog'

type MetricsToolName = 'get_metrics'
type MetricsTool = ExtendedTool<MetricsToolName>

export const METRICS_TOOLS: MetricsTool[] = [
  createToolSchema(
    GetMetricsZodSchema,
    'get_metrics',
    'Get metrics data from Datadog',
  ),
] as const

const API_INSTANCE = new v1.MetricsApi(datadogConfig)

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const METRICS_HANDLERS: MetricsToolHandlers = {
  get_metrics: async (request) => {
    const { from, to, query } = GetMetricsZodSchema.parse(
      request.params.arguments,
    )

    const response = await API_INSTANCE.queryMetrics({
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
} as const
