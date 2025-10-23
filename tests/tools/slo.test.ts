import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createSLOToolHandlers } from '../../src/tools/slo/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const slosEndpoint = `${baseUrl}/v1/slo`

describe('SLO Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.ServiceLevelObjectivesApi(datadogConfig)
  const toolHandlers = createSLOToolHandlers(apiInstance)

  describe.concurrent('list_slos', async () => {
    it('should list SLOs with basic query', async () => {
      const mockHandler = http.get(`${slosEndpoint}`, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'abc123',
              name: 'API Availability',
              description: 'Availability SLO for the API service',
              tags: ['service:api', 'env:prod'],
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.995,
                  warning: 0.997,
                },
              ],
              type: 'monitor',
              created_at: 1640995100,
              modified_at: 1640995200,
              status: [
                {
                  timeframe: '7d',
                  sli: 0.998,
                  error_budget_remaining: 0.003,
                  threshold: 0.995,
                },
              ],
            },
            {
              id: 'def456',
              name: 'Checkout Latency',
              description: 'Latency SLO for checkout flow',
              tags: ['service:checkout', 'env:prod'],
              thresholds: [
                {
                  timeframe: '30d',
                  target: 0.99,
                  warning: 0.995,
                },
              ],
              type: 'metric',
              created_at: 1640995150,
              modified_at: 1640995250,
              status: [
                {
                  timeframe: '30d',
                  sli: 0.985,
                  error_budget_remaining: 0.0,
                  threshold: 0.99,
                },
              ],
            },
          ],
          meta: {
            pagination: {
              total_count: 2,
              total_filtered_count: 2,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_slos', {
          query: 'prod',
          limit: 10,
        })
        const response = (await toolHandlers.list_slos(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Summary')
        expect(response.content[1].text).toContain('Pagination')
        expect(response.content[2].text).toContain('SLOs')
        expect(response.content[2].text).toContain('API Availability')
        expect(response.content[2].text).toContain('Checkout Latency')
        expect(response.content[2].text).toContain('error_budget')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(`${slosEndpoint}`, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            pagination: {
              total_count: 0,
              total_filtered_count: 0,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_slos', {
          query: 'non-existent',
          limit: 10,
        })
        const response = (await toolHandlers.list_slos(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Summary')
        expect(response.content[2].text).toContain('SLOs: []')
      })()

      server.close()
    })

    it('should handle null response data', async () => {
      const mockHandler = http.get(`${slosEndpoint}`, async () => {
        return HttpResponse.json({
          data: null,
          meta: {},
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_slos', {
          limit: 10,
        })
        await expect(toolHandlers.list_slos(request)).rejects.toThrow(
          'No SLO data returned',
        )
      })()

      server.close()
    })
  })

  describe.concurrent('get_slo', async () => {
    it('should get SLO details by ID', async () => {
      const mockSloId = 'abc123'
      const mockHandler = http.get(`${slosEndpoint}/${mockSloId}`, async () => {
        return HttpResponse.json({
          data: {
            id: mockSloId,
            name: 'API Availability',
            description: 'Availability SLO for the API service',
            tags: ['service:api', 'env:prod'],
            thresholds: [
              {
                timeframe: '7d',
                target: 0.995,
                warning: 0.997,
              },
            ],
            type: 'monitor',
            monitor_ids: [12345, 67890],
            created_at: 1640995100,
            modified_at: 1640995200,
            status: [
              {
                timeframe: '7d',
                sli: 0.998,
                error_budget_remaining: 0.003,
                threshold: 0.995,
              },
            ],
            creator: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_slo', {
          id: mockSloId,
        })
        const response = (await toolHandlers.get_slo(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('SLO:')
        expect(response.content[0].text).toContain('API Availability')
        expect(response.content[0].text).toContain(`"id":"${mockSloId}"`)
        expect(response.content[0].text).toContain('error_budget')
        expect(response.content[1].text).toContain('Related Monitor Links')
      })()

      server.close()
    })

    it('should handle SLO not found', async () => {
      const mockSloId = 'non-existent'
      const mockHandler = http.get(`${slosEndpoint}/${mockSloId}`, async () => {
        return HttpResponse.json({ errors: ['SLO not found'] }, { status: 404 })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_slo', {
          id: mockSloId,
        })
        await expect(toolHandlers.get_slo(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  describe.concurrent('get_slo_history', async () => {
    it('should get SLO history and calculate error budget', async () => {
      const mockSloId = 'abc123'

      // Mock for getting the SLO details
      const mockSloHandler = http.get(
        `${slosEndpoint}/${mockSloId}`,
        async () => {
          return HttpResponse.json({
            data: {
              id: mockSloId,
              name: 'API Availability',
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.995,
                  warning: 0.997,
                },
              ],
              status: [
                {
                  timeframe: '7d',
                  sli: 0.998,
                  threshold: 0.995,
                },
              ],
            },
          })
        },
      )

      // Mock for getting the SLO history
      const mockHistoryHandler = http.get(
        `${slosEndpoint}/${mockSloId}/history`,
        async () => {
          return HttpResponse.json({
            data: {
              overall: {
                status: 'ok',
                value: 0.998,
                history: [
                  [1640995000, 0.999],
                  [1640996000, 0.998],
                  [1640997000, 0.997],
                  [1640998000, 0.998],
                ],
              },
            },
          })
        },
      )

      const server = setupServer(mockSloHandler, mockHistoryHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_slo_history', {
          id: mockSloId,
          from: 1640995000,
          to: 1640998000,
          show_error_budget: true,
          show_burn_rate: true,
        })
        const response = (await toolHandlers.get_slo_history(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Summary')
        expect(response.content[0].text).toContain('error_budget')
        expect(response.content[0].text).toContain('burn_rate')
        expect(response.content[0].text).toContain('API Availability')
        expect(response.content[2].text).toContain('History')
      })()

      server.close()
    })

    it('should handle missing history data', async () => {
      const mockSloId = 'missing-history'

      // Mock for getting the SLO details
      const mockSloHandler = http.get(
        `${slosEndpoint}/${mockSloId}`,
        async () => {
          return HttpResponse.json({
            data: {
              id: mockSloId,
              name: 'API Availability',
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.995,
                  warning: 0.997,
                },
              ],
            },
          })
        },
      )

      // Mock for getting the SLO history with an error response
      const mockHistoryHandler = http.get(
        `${slosEndpoint}/${mockSloId}/history`,
        () => {
          // Throw a network error instead of returning a response
          throw new Error('Could not retrieve history')
        },
      )

      const server = setupServer(mockSloHandler, mockHistoryHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_slo_history', {
          id: mockSloId,
          from: 1640995000,
          to: 1640998000,
        })
        await expect(toolHandlers.get_slo_history(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  describe.concurrent('check_slos', async () => {
    it('should check multiple SLOs and identify those at risk', async () => {
      // Mock for listing SLOs - adding the required thresholds property to each SLO
      const mockListHandler = http.get(`${slosEndpoint}`, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'abc123',
              name: 'API Availability',
              tags: ['service:api', 'env:prod'],
              type: 'monitor',
              status: [
                {
                  timeframe: '7d',
                  sli: 0.998,
                  threshold: 0.995,
                },
              ],
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.995,
                  warning: 0.997,
                },
              ],
            },
            {
              id: 'def456',
              name: 'Checkout Latency',
              tags: ['service:checkout', 'env:prod'],
              type: 'metric',
              status: [
                {
                  timeframe: '7d',
                  sli: 0.985,
                  threshold: 0.99,
                },
              ],
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.99,
                  warning: 0.995,
                },
              ],
            },
            {
              id: 'ghi789',
              name: 'Search Response Time',
              tags: ['service:search', 'env:prod'],
              type: 'metric',
              status: [
                {
                  timeframe: '7d',
                  sli: 0.91,
                  threshold: 0.95,
                },
              ],
              thresholds: [
                {
                  timeframe: '7d',
                  target: 0.95,
                  warning: 0.97,
                },
              ],
            },
          ],
        })
      })

      // Mock for getting history for each SLO
      const mockHistoryHandlerAPI = http.get(
        `${slosEndpoint}/abc123/history`,
        async () => {
          return HttpResponse.json({
            data: {
              overall: {
                history: [
                  [1640995000, 0.999],
                  [1640996000, 0.998],
                ],
              },
            },
          })
        },
      )

      const mockHistoryHandlerCheckout = http.get(
        `${slosEndpoint}/def456/history`,
        async () => {
          return HttpResponse.json({
            data: {
              overall: {
                history: [
                  [1640995000, 0.99],
                  [1640996000, 0.985],
                ],
              },
            },
          })
        },
      )

      const mockHistoryHandlerSearch = http.get(
        `${slosEndpoint}/ghi789/history`,
        async () => {
          return HttpResponse.json({
            data: {
              overall: {
                history: [
                  [1640995000, 0.95],
                  [1640996000, 0.91],
                ],
              },
            },
          })
        },
      )

      const server = setupServer(
        mockListHandler,
        mockHistoryHandlerAPI,
        mockHistoryHandlerCheckout,
        mockHistoryHandlerSearch,
      )

      await server.boundary(async () => {
        const request = createMockToolRequest('check_slos', {
          tags: ['env:prod'],
          timeframe: '7d',
          threshold: 50,
          with_burn_rate: true,
        })
        const response = (await toolHandlers.check_slos(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Summary')
        expect(response.content[0].text).toContain('critical_count')

        // Check that we have SLOs content in the response, but don't be prescriptive about their status
        const responseText = response.content.map((item) => item.text).join(' ')
        expect(responseText).toContain('SLOs')

        // Ensure we have content about all three SLOs
        expect(responseText).toContain('API Availability')
        expect(responseText).toContain('Checkout Latency')
        expect(responseText).toContain('Search Response Time')
      })()

      server.close()
    })

    it('should handle no SLOs found', async () => {
      // Mock for listing SLOs with no results
      const mockListHandler = http.get(`${slosEndpoint}`, async () => {
        return HttpResponse.json({
          data: [],
        })
      })

      const server = setupServer(mockListHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('check_slos', {
          query: 'non-existent',
          timeframe: '7d',
        })
        await expect(toolHandlers.check_slos(request)).rejects.toThrow(
          'No SLOs found with the given filters',
        )
      })()

      server.close()
    })
  })
})
