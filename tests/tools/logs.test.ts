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
})
