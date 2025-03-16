import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createDowntimesToolHandlers } from '../../src/tools/downtimes/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const downtimesEndpoint = `${baseUrl}/v1/downtime`

describe('Downtimes Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.DowntimesApi(datadogConfig)
  const toolHandlers = createDowntimesToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/downtimes/#get-all-downtimes
  describe.concurrent('list_downtimes', async () => {
    it('should list downtimes', async () => {
      const mockHandler = http.get(downtimesEndpoint, async () => {
        return HttpResponse.json([
          {
            id: 123456789,
            active: true,
            disabled: false,
            start: 1640995100,
            end: 1640995200,
            scope: ['host:test-host'],
            message: 'Test downtime',
            monitor_id: 87654321,
            created: 1640995000,
            creator_id: 12345,
            updated_at: 1640995010,
            monitor_tags: ['env:test'],
          },
          {
            id: 987654321,
            active: false,
            disabled: false,
            start: 1641095100,
            end: 1641095200,
            scope: ['service:web'],
            message: 'Another test downtime',
            monitor_id: null,
            created: 1641095000,
            creator_id: 12345,
            updated_at: 1641095010,
            monitor_tags: ['service:web'],
          },
        ])
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_downtimes', {
          currentOnly: true,
        })
        const response = (await toolHandlers.list_downtimes(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Listed downtimes:')
        expect(response.content[0].text).toContain('Test downtime')
        expect(response.content[0].text).toContain('Another test downtime')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(downtimesEndpoint, async () => {
        return HttpResponse.json([])
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_downtimes', {
          currentOnly: false,
        })
        const response = (await toolHandlers.list_downtimes(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Listed downtimes:')
        expect(response.content[0].text).toContain('[]')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(downtimesEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_downtimes', {})
        await expect(toolHandlers.list_downtimes(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.get(downtimesEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_downtimes', {})
        await expect(toolHandlers.list_downtimes(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/downtimes/#schedule-a-downtime
  describe.concurrent('schedule_downtime', async () => {
    it('should schedule a downtime', async () => {
      const mockHandler = http.post(downtimesEndpoint, async () => {
        return HttpResponse.json({
          id: 123456789,
          active: true,
          disabled: false,
          start: 1640995100,
          end: 1640995200,
          scope: ['host:test-host'],
          message: 'Scheduled maintenance',
          monitor_id: null,
          timezone: 'UTC',
          created: 1640995000,
          creator_id: 12345,
          updated_at: 1640995000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('schedule_downtime', {
          scope: 'host:test-host',
          start: 1640995100,
          end: 1640995200,
          message: 'Scheduled maintenance',
          timezone: 'UTC',
        })
        const response = (await toolHandlers.schedule_downtime(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Scheduled downtime:')
        expect(response.content[0].text).toContain('123456789')
        expect(response.content[0].text).toContain('Scheduled maintenance')
      })()

      server.close()
    })

    it('should schedule a recurring downtime', async () => {
      const mockHandler = http.post(downtimesEndpoint, async () => {
        return HttpResponse.json({
          id: 123456789,
          active: true,
          disabled: false,
          message: 'Weekly maintenance',
          scope: ['service:api'],
          recurrence: {
            type: 'weeks',
            period: 1,
            week_days: ['Mon'],
          },
          created: 1640995000,
          creator_id: 12345,
          updated_at: 1640995000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('schedule_downtime', {
          scope: 'service:api',
          message: 'Weekly maintenance',
          recurrence: {
            type: 'weeks',
            period: 1,
            weekDays: ['Mon'],
          },
        })
        const response = (await toolHandlers.schedule_downtime(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Scheduled downtime:')
        expect(response.content[0].text).toContain('Weekly maintenance')
        expect(response.content[0].text).toContain('weeks')
        expect(response.content[0].text).toContain('Mon')
      })()

      server.close()
    })

    it('should handle validation errors', async () => {
      const mockHandler = http.post(downtimesEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Invalid scope format'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('schedule_downtime', {
          scope: 'invalid:format',
          start: 1640995100,
          end: 1640995200,
        })
        await expect(toolHandlers.schedule_downtime(request)).rejects.toThrow(
          'Invalid scope format',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/downtimes/#cancel-a-downtime
  describe.concurrent('cancel_downtime', async () => {
    it('should cancel a downtime', async () => {
      const downtimeId = 123456789
      const mockHandler = http.delete(
        `${downtimesEndpoint}/${downtimeId}`,
        async () => {
          return new HttpResponse(null, { status: 204 })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('cancel_downtime', {
          downtimeId,
        })
        const response = (await toolHandlers.cancel_downtime(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          `Cancelled downtime with ID: ${downtimeId}`,
        )
      })()

      server.close()
    })

    it('should handle not found errors', async () => {
      const downtimeId = 999999999
      const mockHandler = http.delete(
        `${downtimesEndpoint}/${downtimeId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Downtime not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('cancel_downtime', {
          downtimeId,
        })
        await expect(toolHandlers.cancel_downtime(request)).rejects.toThrow(
          'Downtime not found',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const downtimeId = 123456789
      const mockHandler = http.delete(
        `${downtimesEndpoint}/${downtimeId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Internal server error'] },
            { status: 500 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('cancel_downtime', {
          downtimeId,
        })
        await expect(toolHandlers.cancel_downtime(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })
})
