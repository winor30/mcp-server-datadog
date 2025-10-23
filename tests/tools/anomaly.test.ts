import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createAnomalyToolHandlers } from '../../src/tools/anomaly/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const metricsEndpoint = `${baseUrl}/v1/query`

describe('Anomaly Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.MetricsApi(datadogConfig)
  const toolHandlers = createAnomalyToolHandlers(apiInstance)

  describe.concurrent('get_anomalies', async () => {
    it('should detect anomalies in metrics data', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: "anomalies(avg:system.cpu.user{*}, 'basic', 2)",
          series: [
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                // Format for anomaly points: [timestamp, value, lower_bound, upper_bound]
                [1640995000000, 23.45, 15.0, 25.0], // Normal (within bounds)
                [1640995060000, 24.12, 15.0, 25.0], // Normal (within bounds)
                [1640995120000, 32.89, 15.0, 25.0], // Anomaly (above upper bound)
                [1640995180000, 12.67, 15.0, 25.0], // Anomaly (below lower bound)
                [1640995240000, 22.5, 15.0, 25.0], // Normal (within bounds)
              ],
              scope: 'host:web-01',
              expression: "anomalies(avg:system.cpu.user{*}, 'basic', 2)",
              unit: [
                {
                  family: 'percentage',
                  scale_factor: 1,
                  name: 'percent',
                  short_name: '%',
                },
              ],
              metadata: {
                algorithm: 'basic',
                threshold: 2,
                confidence: 0.95,
              },
            },
          ],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'avg:system.cpu.user{*}',
          from: 1640995000,
          to: 1641095000,
          algorithm: 'basic',
          threshold: 2,
        })

        const response = (await toolHandlers.get_anomalies(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Anomaly detection results:')
        expect(response.content[0].text).toContain('anomalousPoints')
        expect(response.content[0].text).toContain('32.89') // Above upper bound
        expect(response.content[0].text).toContain('12.67') // Below lower bound
        expect(response.content[0].text).toContain('anomaliesFound')
        expect(response.content[0].text).toContain('algorithm')
        expect(response.content[0].text).toContain('threshold')
      })()

      server.close()
    })

    it('should handle anomaly detection with seasonality parameter', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: "anomalies(avg:system.cpu.user{*}, 'agile', 3, 'day')",
          series: [
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 23.45, 18.0, 28.0],
                [1640995060000, 24.12, 18.0, 28.0],
                [1640995120000, 35.89, 18.0, 28.0], // Anomaly
                [1640995180000, 22.67, 18.0, 28.0],
              ],
              scope: 'host:web-01',
              expression:
                "anomalies(avg:system.cpu.user{*}, 'agile', 3, 'day')",
              metadata: {
                algorithm: 'agile',
                threshold: 3,
                seasonality: 'day',
                confidence: 0.97,
              },
            },
          ],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'avg:system.cpu.user{*}',
          from: 1640995000,
          to: 1641095000,
          algorithm: 'agile',
          threshold: 3,
          seasonality: 'day',
        })

        const response = (await toolHandlers.get_anomalies(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Anomaly detection results:')
        expect(response.content[0].text).toContain('35.89') // The anomalous value
        expect(response.content[0].text).toContain('seasonality')
        expect(response.content[0].text).toContain('day')
      })()

      server.close()
    })

    it('should include normal points when includeNormal is true', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: "anomalies(avg:system.cpu.user{*}, 'robust', 2)",
          series: [
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 23.45, 15.0, 25.0], // Normal
                [1640995060000, 24.12, 15.0, 25.0], // Normal
                [1640995120000, 32.89, 15.0, 25.0], // Anomaly
              ],
              scope: 'host:web-01',
              expression: "anomalies(avg:system.cpu.user{*}, 'robust', 2)",
            },
          ],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'avg:system.cpu.user{*}',
          from: 1640995000,
          to: 1641095000,
          algorithm: 'robust',
          threshold: 2,
          includeNormal: true,
        })

        const response = (await toolHandlers.get_anomalies(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('normalPoints')
        expect(response.content[0].text).toContain('23.45') // Normal point
        expect(response.content[0].text).toContain('24.12') // Normal point
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: "anomalies(avg:non.existent.metric{*}, 'basic', 2)",
          series: [],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'avg:non.existent.metric{*}',
          from: 1640995000,
          to: 1641095000,
        })

        const response = (await toolHandlers.get_anomalies(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'No data returned for the specified query and time range',
        )
      })()

      server.close()
    })

    it('should handle error responses', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Invalid anomaly query format'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'invalid:metric:format',
          from: 1640995000,
          to: 1641095000,
        })

        await expect(toolHandlers.get_anomalies(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle API errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_anomalies', {
          metric: 'avg:system.cpu.user{*}',
          from: 1640995000,
          to: 1641095000,
        })

        await expect(toolHandlers.get_anomalies(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })
  })
})
