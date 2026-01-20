import { v1, v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createMetricsToolHandlers } from '../../src/tools/metrics/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const metricsEndpoint = `${baseUrl}/v1/query`
const searchMetricsEndpoint = `${baseUrl}/v1/search`
const activeMetricsEndpoint = `${baseUrl}/v1/metrics`
const metricMetadataEndpoint = `${baseUrl}/v1/metrics`
const tagsEndpoint = `${baseUrl}/v2/metrics`

describe('Metrics Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const v1ApiInstance = new v1.MetricsApi(datadogConfig)
  const v2ApiInstance = new v2.MetricsApi(datadogConfig)
  const toolHandlers = createMetricsToolHandlers(v1ApiInstance, v2ApiInstance)

  // https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data-across-multiple-products
  describe.concurrent('query_metrics', async () => {
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
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        const response = (await toolHandlers.query_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Queried metrics data:')
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
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:non.existent.metric{*}',
        })
        const response = (await toolHandlers.query_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Queried metrics data:')
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
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'invalid:query:format',
        })
        const response = (await toolHandlers.query_metrics(
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
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow()
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
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow(
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
        const request = createMockToolRequest('query_metrics', {
          from: 1600000000, // Very old date
          to: 1700000000, // Very recent date
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow(
          'Time range exceeds allowed limit',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/metrics/#search-metrics
  describe.concurrent('search_metrics', async () => {
    it('should search for metrics', async () => {
      const mockHandler = http.get(searchMetricsEndpoint, async () => {
        return HttpResponse.json({
          results: {
            metrics: [
              'system.cpu.user',
              'system.cpu.system',
              'system.cpu.idle',
              'system.cpu.iowait',
            ],
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_metrics', {
          q: 'system.cpu',
        })
        const response = (await toolHandlers.search_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Metrics search results')
        expect(response.content[0].text).toContain('system.cpu.user')
        expect(response.content[0].text).toContain('system.cpu.system')
      })()

      server.close()
    })

    it('should handle empty search results', async () => {
      const mockHandler = http.get(searchMetricsEndpoint, async () => {
        return HttpResponse.json({
          results: {
            metrics: [],
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_metrics', {
          q: 'nonexistent.metric.name',
        })
        const response = (await toolHandlers.search_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Metrics search results')
        expect(response.content[0].text).toContain('metrics":[]')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(searchMetricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_metrics', {
          q: 'system.cpu',
        })
        await expect(toolHandlers.search_metrics(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/metrics/#get-active-metrics-list
  describe.concurrent('list_active_metrics', async () => {
    it('should list active metrics', async () => {
      const mockHandler = http.get(activeMetricsEndpoint, async () => {
        return HttpResponse.json({
          metrics: ['system.cpu.user', 'system.mem.used', 'system.disk.total'],
          from: '1640995000',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_active_metrics', {
          from: 1640995000,
        })
        const response = (await toolHandlers.list_active_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Active metrics')
        expect(response.content[0].text).toContain('system.cpu.user')
        expect(response.content[0].text).toContain('system.mem.used')
      })()

      server.close()
    })

    it('should list active metrics with host filter', async () => {
      const mockHandler = http.get(activeMetricsEndpoint, async () => {
        return HttpResponse.json({
          metrics: ['system.cpu.user'],
          from: '1640995000',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_active_metrics', {
          from: 1640995000,
          host: 'web-01',
        })
        const response = (await toolHandlers.list_active_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Active metrics')
        expect(response.content[0].text).toContain('system.cpu.user')
      })()

      server.close()
    })

    it('should list active metrics with tag filter', async () => {
      const mockHandler = http.get(activeMetricsEndpoint, async () => {
        return HttpResponse.json({
          metrics: ['custom.metric.production'],
          from: '1640995000',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_active_metrics', {
          from: 1640995000,
          tagFilter: 'env:production',
        })
        const response = (await toolHandlers.list_active_metrics(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Active metrics')
        expect(response.content[0].text).toContain('custom.metric.production')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(activeMetricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_active_metrics', {
          from: 1640995000,
        })
        await expect(
          toolHandlers.list_active_metrics(request),
        ).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/metrics/#get-metric-metadata
  describe.concurrent('get_metric_metadata', async () => {
    it('should get metric metadata', async () => {
      const metricName = 'system.cpu.user'
      const mockHandler = http.get(
        `${metricMetadataEndpoint}/${metricName}`,
        async () => {
          return HttpResponse.json({
            description: 'Percentage of CPU time spent in user space',
            short_name: 'cpu user',
            integration: 'system',
            statsd_interval: 10,
            per_unit: null,
            unit: 'percent',
            type: 'gauge',
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metric_metadata', {
          metricName,
        })
        const response = (await toolHandlers.get_metric_metadata(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Metric metadata')
        expect(response.content[0].text).toContain('system.cpu.user')
        expect(response.content[0].text).toContain('Percentage of CPU time')
        expect(response.content[0].text).toContain('percent')
        expect(response.content[0].text).toContain('gauge')
      })()

      server.close()
    })

    it('should handle not found errors', async () => {
      const metricName = 'nonexistent.metric'
      const mockHandler = http.get(
        `${metricMetadataEndpoint}/${metricName}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Metric not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metric_metadata', {
          metricName,
        })
        await expect(toolHandlers.get_metric_metadata(request)).rejects.toThrow(
          'Metric not found',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const metricName = 'system.cpu.user'
      const mockHandler = http.get(
        `${metricMetadataEndpoint}/${metricName}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Authentication failed'] },
            { status: 403 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metric_metadata', {
          metricName,
        })
        await expect(
          toolHandlers.get_metric_metadata(request),
        ).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/metrics/#list-tags-by-metric-name
  describe.concurrent('list_tags_by_metric', async () => {
    it('should list tags for a metric', async () => {
      const metricName = 'system.cpu.user'
      const mockHandler = http.get(
        `${tagsEndpoint}/${metricName}/all-tags`,
        async () => {
          return HttpResponse.json({
            data: {
              id: 'system.cpu.user',
              type: 'metrics',
              attributes: {
                tags: ['host', 'env', 'service', 'region'],
              },
            },
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_tags_by_metric', {
          metricName,
        })
        const response = (await toolHandlers.list_tags_by_metric(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Tags for metric')
        expect(response.content[0].text).toContain('system.cpu.user')
        expect(response.content[0].text).toContain('host')
        expect(response.content[0].text).toContain('env')
        expect(response.content[0].text).toContain('service')
      })()

      server.close()
    })

    it('should handle not found errors', async () => {
      const metricName = 'nonexistent.metric'
      const mockHandler = http.get(
        `${tagsEndpoint}/${metricName}/all-tags`,
        async () => {
          return HttpResponse.json(
            { errors: ['Metric not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_tags_by_metric', {
          metricName,
        })
        await expect(toolHandlers.list_tags_by_metric(request)).rejects.toThrow(
          'Metric not found',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const metricName = 'system.cpu.user'
      const mockHandler = http.get(
        `${tagsEndpoint}/${metricName}/all-tags`,
        async () => {
          return HttpResponse.json(
            { errors: ['Authentication failed'] },
            { status: 403 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_tags_by_metric', {
          metricName,
        })
        await expect(
          toolHandlers.list_tags_by_metric(request),
        ).rejects.toThrow()
      })()

      server.close()
    })
  })
})
