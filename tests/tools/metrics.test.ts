import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createMetricsToolHandlers } from '../../src/tools/metrics/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const metricsEndpoint = `${baseUrl}/v1/query`

describe('Metrics Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.MetricsApi(datadogConfig)
  const toolHandlers = createMetricsToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data-across-multiple-products
  describe.concurrent('get_metrics', async () => {
    it('should query metrics data', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: 'avg:system.cpu.user{*}',
          series: [
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 23.45],
                [1640995060000, 24.12],
                [1640995120000, 22.89],
                [1640995180000, 25.67],
              ],
              scope: 'host:web-01',
              expression: 'avg:system.cpu.user{*}',
              unit: [
                {
                  family: 'percentage',
                  scale_factor: 1,
                  name: 'percent',
                  short_name: '%',
                },
              ],
            },
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 18.32],
                [1640995060000, 19.01],
                [1640995120000, 17.76],
                [1640995180000, 20.45],
              ],
              scope: 'host:web-02',
              expression: 'avg:system.cpu.user{*}',
              unit: [
                {
                  family: 'percentage',
                  scale_factor: 1,
                  name: 'percent',
                  short_name: '%',
                },
              ],
            },
          ],
          from_date: 1640995000000,
          to_date: 1641095000000,
          group_by: ['host'],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        const response = (await toolHandlers.get_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Metrics data:')
        expect(response.content[0].text).toContain('system.cpu.user')
        expect(response.content[0].text).toContain('host:web-01')
        expect(response.content[0].text).toContain('host:web-02')
        expect(response.content[0].text).toContain('23.45')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: 'avg:non.existent.metric{*}',
          series: [],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:non.existent.metric{*}',
        })
        const response = (await toolHandlers.get_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Metrics data:')
        expect(response.content[0].text).toContain('series":[]')
      })()

      server.close()
    })

    it('should handle failed query status', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'error',
          message: 'Invalid query format',
          query: 'invalid:query:format',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'invalid:query:format',
        })
        const response = (await toolHandlers.get_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('status":"error"')
        expect(response.content[0].text).toContain('Invalid query format')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.get_metrics(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.get_metrics(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })

    it('should handle invalid time range errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Time range exceeds allowed limit'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        // Using a very large time range that might exceed limits
        const request = createMockToolRequest('get_metrics', {
          from: 1600000000, // Very old date
          to: 1700000000, // Very recent date
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.get_metrics(request)).rejects.toThrow(
          'Time range exceeds allowed limit',
        )
      })()

      server.close()
    })
  })
})
