import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1, v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  QueryMetricsZodSchema,
  SearchMetricsZodSchema,
  ListActiveMetricsZodSchema,
  GetMetricMetadataZodSchema,
  ListTagsByMetricZodSchema,
} from './schema'

type MetricsToolName =
  | 'query_metrics'
  | 'search_metrics'
  | 'list_active_metrics'
  | 'get_metric_metadata'
  | 'list_tags_by_metric'
type MetricsTool = ExtendedTool<MetricsToolName>

export const METRICS_TOOLS: MetricsTool[] = [
  createToolSchema(
    QueryMetricsZodSchema,
    'query_metrics',
    'Query timeseries points of metrics from Datadog',
  ),
  createToolSchema(
    SearchMetricsZodSchema,
    'search_metrics',
    'Search for metrics from the last 24 hours in Datadog. Returns metric names matching the query.',
  ),
  createToolSchema(
    ListActiveMetricsZodSchema,
    'list_active_metrics',
    'Get the list of actively reporting metrics from a given time until now.',
  ),
  createToolSchema(
    GetMetricMetadataZodSchema,
    'get_metric_metadata',
    'Get metadata about a specific metric including description, unit, type, and more.',
  ),
  createToolSchema(
    ListTagsByMetricZodSchema,
    'list_tags_by_metric',
    'View indexed tag key-value pairs for a given metric name over the previous hour.',
  ),
] as const

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const createMetricsToolHandlers = (
  v1ApiInstance: v1.MetricsApi,
  v2ApiInstance: v2.MetricsApi,
): MetricsToolHandlers => {
  return {
    query_metrics: async (request) => {
      const { from, to, query } = QueryMetricsZodSchema.parse(
        request.params.arguments,
      )

      const response = await v1ApiInstance.queryMetrics({
        from,
        to,
        query,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Queried metrics data: ${JSON.stringify({ response })}`,
          },
        ],
      }
    },
    search_metrics: async (request) => {
      const { q } = SearchMetricsZodSchema.parse(request.params.arguments)

      const response = await v1ApiInstance.listMetrics({ q })

      return {
        content: [
          {
            type: 'text',
            text: `Metrics search results: ${JSON.stringify(response)}`,
          },
        ],
      }
    },
    list_active_metrics: async (request) => {
      const { from, host, tagFilter } = ListActiveMetricsZodSchema.parse(
        request.params.arguments,
      )

      const response = await v1ApiInstance.listActiveMetrics({
        from,
        host,
        tagFilter,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Active metrics: ${JSON.stringify(response)}`,
          },
        ],
      }
    },
    get_metric_metadata: async (request) => {
      const { metricName } = GetMetricMetadataZodSchema.parse(
        request.params.arguments,
      )

      const response = await v1ApiInstance.getMetricMetadata({ metricName })

      return {
        content: [
          {
            type: 'text',
            text: `Metric metadata for "${metricName}": ${JSON.stringify(response)}`,
          },
        ],
      }
    },
    list_tags_by_metric: async (request) => {
      const { metricName } = ListTagsByMetricZodSchema.parse(
        request.params.arguments,
      )

      const response = await v2ApiInstance.listTagsByMetricName({ metricName })

      return {
        content: [
          {
            type: 'text',
            text: `Tags for metric "${metricName}": ${JSON.stringify(response)}`,
          },
        ],
      }
    },
  }
}
