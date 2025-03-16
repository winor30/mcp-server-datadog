import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createTracesToolHandlers } from '../../src/tools/traces/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const tracesEndpoint = `${baseUrl}/v2/spans/events/search`

describe('Traces Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.SpansApi(datadogConfig)
  const toolHandlers = createTracesToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/spans/#search-spans
  describe.concurrent('list_traces', async () => {
    it('should list traces with basic query', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'span-id-1',
              type: 'spans',
              attributes: {
                service: 'web-api',
                name: 'http.request',
                resource: 'GET /api/users',
                trace_id: 'trace-id-1',
                span_id: 'span-id-1',
                parent_id: 'parent-id-1',
                start: 1640995100000000000,
                duration: 500000000,
                error: 1,
                meta: {
                  'http.method': 'GET',
                  'http.status_code': '500',
                  'error.type': 'Internal Server Error',
                },
              },
            },
            {
              id: 'span-id-2',
              type: 'spans',
              attributes: {
                service: 'web-api',
                name: 'http.request',
                resource: 'GET /api/products',
                trace_id: 'trace-id-2',
                span_id: 'span-id-2',
                parent_id: 'parent-id-2',
                start: 1640995000000000000,
                duration: 300000000,
                error: 1,
                meta: {
                  'http.method': 'GET',
                  'http.status_code': '500',
                  'error.type': 'Internal Server Error',
                },
              },
            },
          ],
          meta: {
            page: {
              after: 'cursor-value',
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: 'http.status_code:500',
          from: 1640995000,
          to: 1640996000,
          limit: 50,
        })
        const response = (await toolHandlers.list_traces(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Traces:')
        expect(response.content[0].text).toContain('web-api')
        expect(response.content[0].text).toContain('GET /api/users')
        expect(response.content[0].text).toContain('GET /api/products')
        expect(response.content[0].text).toContain('count":2')
      })()

      server.close()
    })

    it('should include service and operation filters', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'span-id-3',
              type: 'spans',
              attributes: {
                service: 'payment-service',
                name: 'process-payment',
                resource: 'process-payment',
                trace_id: 'trace-id-3',
                span_id: 'span-id-3',
                parent_id: 'parent-id-3',
                start: 1640995100000000000,
                duration: 800000000,
                error: 1,
                meta: {
                  'error.type': 'PaymentProcessingError',
                },
              },
            },
          ],
          meta: {
            page: {
              after: null,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: 'error:true',
          from: 1640995000,
          to: 1640996000,
          service: 'payment-service',
          operation: 'process-payment',
        })
        const response = (await toolHandlers.list_traces(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('payment-service')
        expect(response.content[0].text).toContain('process-payment')
        expect(response.content[0].text).toContain('PaymentProcessingError')
      })()

      server.close()
    })

    it('should handle ascending sort', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'span-id-oldest',
              type: 'spans',
              attributes: {
                service: 'api',
                name: 'http.request',
                start: 1640995000000000000,
              },
            },
            {
              id: 'span-id-newest',
              type: 'spans',
              attributes: {
                service: 'api',
                name: 'http.request',
                start: 1640995100000000000,
              },
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: '',
          from: 1640995000,
          to: 1640996000,
          sort: 'timestamp', // ascending order
        })
        const response = (await toolHandlers.list_traces(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('span-id-oldest')
        expect(response.content[0].text).toContain('span-id-newest')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: 'service:non-existent',
          from: 1640995000,
          to: 1640996000,
        })
        const response = (await toolHandlers.list_traces(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Traces:')
        expect(response.content[0].text).toContain('count":0')
        expect(response.content[0].text).toContain('traces":[]')
      })()

      server.close()
    })

    it('should handle null response data', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json({
          data: null,
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: '',
          from: 1640995000,
          to: 1640996000,
        })
        await expect(toolHandlers.list_traces(request)).rejects.toThrow(
          'No traces data returned',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: '',
          from: 1640995000,
          to: 1640996000,
        })
        await expect(toolHandlers.list_traces(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.post(tracesEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_traces', {
          query: '',
          from: 1640995000,
          to: 1640996000,
        })
        await expect(toolHandlers.list_traces(request)).rejects.toThrow(
          /errors./,
        )
      })()

      server.close()
    })
  })
})
