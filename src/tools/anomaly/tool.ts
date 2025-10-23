import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetAnomaliesZodSchema } from './schema'

/**
 * Type definitions for the anomaly detection tool
 */
type AnomalyToolName = 'get_anomalies'
type AnomalyTool = ExtendedTool<AnomalyToolName>

/**
 * Tool definition for anomaly detection
 */
export const ANOMALY_TOOLS: AnomalyTool[] = [
  createToolSchema(
    GetAnomaliesZodSchema,
    'get_anomalies',
    'Detect anomalies in Datadog metrics using various algorithms',
  ),
] as const

type AnomalyToolHandlers = ToolHandlers<AnomalyToolName>

/**
 * Creates handlers for anomaly detection tools
 *
 * @param apiInstance - The Datadog metrics API instance
 * @returns Handlers for anomaly detection tools
 */
export const createAnomalyToolHandlers = (
  apiInstance: v1.MetricsApi,
): AnomalyToolHandlers => {
  return {
    get_anomalies: async (request) => {
      const {
        metric,
        from,
        to,
        algorithm,
        threshold,
        seasonality,
        includeNormal,
        includeMetadata,
      } = GetAnomaliesZodSchema.parse(request.params.arguments)

      try {
        // Construct the anomaly detection query
        let anomalyQuery = `anomalies(${metric}, '${algorithm}', ${threshold}`

        // Add seasonality if specified
        if (seasonality) {
          anomalyQuery += `, '${seasonality}'`
        }

        // Close the function
        anomalyQuery += `)`

        console.log(`Executing anomaly query: ${anomalyQuery}`)

        // Execute the query via the metrics API
        const response = await apiInstance.queryMetrics({
          from,
          to,
          query: anomalyQuery,
        })

        // Extract the anomaly points from the response
        const series = response.series || []

        if (series.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No data returned for the specified query and time range.',
              },
            ],
          }
        }

        // Process the anomaly data
        const anomalySeries = series[0]
        const pointsData = anomalySeries.pointlist || []

        // Separate normal from anomalous points
        const anomalousPoints = []
        const normalPoints = []

        for (const point of pointsData) {
          // Pointlist format for anomalies: [timestamp, value, lower_bound, upper_bound]
          if (point.length < 3) {
            continue // Skip points without bounds information
          }

          const timestamp = point[0]
          const value = point[1]
          const lowerBound = point.length > 2 ? point[2] : null
          const upperBound = point.length > 3 ? point[3] : null

          // If bounds are provided and value is outside bounds, it's anomalous
          const isAnomalous =
            lowerBound !== null &&
            upperBound !== null &&
            (value < lowerBound || value > upperBound)

          const formattedPoint = {
            timestamp: Math.floor(timestamp / 1000), // Convert to seconds
            value,
            bounds:
              lowerBound !== null && upperBound !== null
                ? [lowerBound, upperBound]
                : null,
          }

          if (isAnomalous) {
            anomalousPoints.push(formattedPoint)
          } else if (includeNormal) {
            normalPoints.push(formattedPoint)
          }
        }

        // Format the response
        const result: Record<string, unknown> = {
          anomalousPoints,
          summary: {
            totalPoints: pointsData.length,
            anomaliesFound: anomalousPoints.length,
            anomalyPercentage:
              pointsData.length > 0
                ? ((anomalousPoints.length / pointsData.length) * 100).toFixed(
                    2,
                  ) + '%'
                : '0%',
          },
        }

        // Add normal points if requested
        if (includeNormal) {
          result.normalPoints = normalPoints
        }

        // Add metadata if requested
        if (includeMetadata && anomalySeries.metadata) {
          result.metadata = anomalySeries.metadata
        }

        // Add query info
        result.query = {
          metric,
          algorithm,
          threshold,
          seasonality: seasonality || 'none',
          timeRange: {
            from,
            to,
            duration: `${Math.floor((to - from) / 60)} minutes`,
          },
        }

        return {
          content: [
            {
              type: 'text',
              text: `Anomaly detection results: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        }
      } catch (error) {
        console.error('Error performing anomaly detection:', error)
        throw new Error(
          `Failed to perform anomaly detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },
  }
}
