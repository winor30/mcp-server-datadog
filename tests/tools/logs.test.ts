import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createLogsToolHandlers } from '../../src/tools/logs/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const logsEndpoint = `${baseUrl}/v2/logs/events/search`

describe('Logs Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.LogsApi(datadogConfig)
  const toolHandlers = createLogsToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/logs/#search-logs
  describe.concurrent('get_logs', async () => {
    it('should retrieve logs', async () => {
      // Mock API response based on Datadog API documentation
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgB',
              attributes: {
                timestamp: 1640995199999,
                status: 'info',
                message: 'Test log message',
                service: 'test-service',
                tags: ['env:test'],
              },
              type: 'log',
            },
          ],
          meta: {
            page: {
              after:
                'eyJzdGFydEF0IjoiQVFBQUFYR0xkRDBBQUFCUFYtNXdocWdCIiwiaW5kZXgiOiJtYWluIn0=',
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test-service',
          from: 1640995100, // epoch seconds
          to: 1640995200, // epoch seconds
          limit: 10,
        })
        const response = (await toolHandlers.get_logs(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Logs data')
        expect(response.content[0].text).toContain('Test log message')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:non-existent',
          from: 1640995100,
          to: 1640995200,
        })
        const response = (await toolHandlers.get_logs(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Logs data')
        expect(response.content[0].text).toContain('[]')
      })()

      server.close()
    })

    it('should handle null response data', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: null,
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await expect(toolHandlers.get_logs(request)).rejects.toThrow(
          'No logs data returned',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await expect(toolHandlers.get_logs(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await expect(toolHandlers.get_logs(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Internal server error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await expect(toolHandlers.get_logs(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })

  describe.concurrent('get_all_services', async () => {
    it('should extract unique service names from logs', async () => {
      // Mock API response with multiple services
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgB',
              attributes: {
                timestamp: 1640995199000,
                status: 'info',
                message: 'Test log message 1',
                service: 'web-service',
                tags: ['env:test'],
              },
              type: 'log',
            },
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgC',
              attributes: {
                timestamp: 1640995198000,
                status: 'info',
                message: 'Test log message 2',
                service: 'api-service',
                tags: ['env:test'],
              },
              type: 'log',
            },
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgD',
              attributes: {
                timestamp: 1640995197000,
                status: 'info',
                message: 'Test log message 3',
                service: 'web-service', // Duplicate service to test uniqueness
                tags: ['env:test'],
              },
              type: 'log',
            },
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgE',
              attributes: {
                timestamp: 1640995196000,
                status: 'error',
                message: 'Test error message',
                service: 'database-service',
                tags: ['env:test'],
              },
              type: 'log',
            },
          ],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_all_services', {
          query: '*',
          from: 1640995100, // epoch seconds
          to: 1640995200, // epoch seconds
          limit: 100,
        })
        const response = (await toolHandlers.get_all_services(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Services')
        // Check if response contains the expected services (sorted alphabetically)
        const expected = ['api-service', 'database-service', 'web-service']
        expected.forEach((service) => {
          expect(response.content[0].text).toContain(service)
        })

        // Check that we've extracted unique services (no duplicates)
        const servicesText = response.content[0].text
        const servicesJson = JSON.parse(
          servicesText.substring(
            servicesText.indexOf('['),
            servicesText.lastIndexOf(']') + 1,
          ),
        )
        expect(servicesJson).toHaveLength(3) // Only 3 unique services, not 4
        expect(servicesJson).toEqual(expected)
      })()

      server.close()
    })

    it('should handle logs with missing service attributes', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgB',
              attributes: {
                timestamp: 1640995199000,
                status: 'info',
                message: 'Test log message 1',
                service: 'web-service',
                tags: ['env:test'],
              },
              type: 'log',
            },
            {
              id: 'AAAAAXGLdD0AAABPV-5whqgC',
              attributes: {
                timestamp: 1640995198000,
                status: 'info',
                message: 'Test log message with no service',
                // No service attribute
                tags: ['env:test'],
              },
              type: 'log',
            },
          ],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_all_services', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          limit: 100,
        })
        const response = (await toolHandlers.get_all_services(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Services')
        expect(response.content[0].text).toContain('web-service')

        // Ensure we only have one service (the one with a defined service attribute)
        const servicesText = response.content[0].text
        const servicesJson = JSON.parse(
          servicesText.substring(
            servicesText.indexOf('['),
            servicesText.lastIndexOf(']') + 1,
          ),
        )
        expect(servicesJson).toHaveLength(1)
      })()

      server.close()
    })

    it('should handle empty response data', async () => {
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_all_services', {
          query: 'service:non-existent',
          from: 1640995100,
          to: 1640995200,
          limit: 100,
        })
        const response = (await toolHandlers.get_all_services(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Services')
        expect(response.content[0].text).toContain('[]') // Empty array of services
      })()

      server.close()
    })
  })
})
