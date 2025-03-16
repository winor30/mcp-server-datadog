import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createMonitorsToolHandlers } from '../../src/tools/monitors/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const monitorsEndpoint = `${baseUrl}/v1/monitor`

describe('Monitors Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.MonitorsApi(datadogConfig)
  const toolHandlers = createMonitorsToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/monitors/#get-all-monitor-details
  describe.concurrent('get_monitors', async () => {
    it('should list monitors', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json([
          {
            id: 12345,
            name: 'Test API Monitor',
            type: 'metric alert',
            message: 'CPU usage is too high',
            tags: ['env:test', 'service:api'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            overall_state: 'Alert',
            created: '2023-01-01T00:00:00.000Z',
            modified: '2023-01-02T00:00:00.000Z',
          },
          {
            id: 67890,
            name: 'Test Web Monitor',
            type: 'service check',
            message: 'Web service is down',
            tags: ['env:test', 'service:web'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            overall_state: 'OK',
            created: '2023-02-01T00:00:00.000Z',
            modified: '2023-02-02T00:00:00.000Z',
          },
        ])
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {
          name: 'test-monitor',
          groupStates: ['alert', 'warn'],
          tags: ['env:test', 'service:api'],
        })
        const response = (await toolHandlers.get_monitors(
          request,
        )) as unknown as DatadogToolResponse

        // Check that monitors data is included
        expect(response.content[0].text).toContain('Monitors:')
        expect(response.content[0].text).toContain('Test API Monitor')
        expect(response.content[0].text).toContain('Test Web Monitor')

        // Check that summary is included
        expect(response.content[1].text).toContain('Summary of monitors:')
        expect(response.content[1].text).toContain('"alert":1')
        expect(response.content[1].text).toContain('"ok":1')
      })()

      server.close()
    })

    it('should handle monitors with various states', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json([
          {
            id: 1,
            name: 'Alert Monitor',
            overall_state: 'Alert',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 2,
            name: 'Warn Monitor',
            overall_state: 'Warn',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 3,
            name: 'No Data Monitor',
            overall_state: 'No Data',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 4,
            name: 'OK Monitor',
            overall_state: 'OK',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 5,
            name: 'Ignored Monitor',
            overall_state: 'Ignored',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 6,
            name: 'Skipped Monitor',
            overall_state: 'Skipped',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
          {
            id: 7,
            name: 'Unknown Monitor',
            overall_state: 'Unknown',
            tags: ['env:test'],
            query: 'avg(last_5m):avg:system.cpu.user{*} > 80',
            type: 'metric alert',
          },
        ])
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {
          tags: ['env:test'],
        })
        const response = (await toolHandlers.get_monitors(
          request,
        )) as unknown as DatadogToolResponse

        // Check summary data has counts for all states
        expect(response.content[1].text).toContain('"alert":1')
        expect(response.content[1].text).toContain('"warn":1')
        expect(response.content[1].text).toContain('"noData":1')
        expect(response.content[1].text).toContain('"ok":1')
        expect(response.content[1].text).toContain('"ignored":1')
        expect(response.content[1].text).toContain('"skipped":1')
        expect(response.content[1].text).toContain('"unknown":1')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json([])
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {
          name: 'non-existent-monitor',
        })
        const response = (await toolHandlers.get_monitors(
          request,
        )) as unknown as DatadogToolResponse

        // Check that response contains empty array
        expect(response.content[0].text).toContain('Monitors: []')

        // Check that summary shows all zeros
        expect(response.content[1].text).toContain('"alert":0')
        expect(response.content[1].text).toContain('"warn":0')
        expect(response.content[1].text).toContain('"noData":0')
        expect(response.content[1].text).toContain('"ok":0')
      })()

      server.close()
    })

    it('should handle null response', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json(null)
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {})
        await expect(toolHandlers.get_monitors(request)).rejects.toThrow(
          'No monitors data returned',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {})
        await expect(toolHandlers.get_monitors(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {})
        await expect(toolHandlers.get_monitors(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const mockHandler = http.get(monitorsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Internal server error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_monitors', {})
        await expect(toolHandlers.get_monitors(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })
})
