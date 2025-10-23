import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createEventsToolHandlers } from '../../src/tools/events/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const eventsEndpoint = `${baseUrl}/v1/events`

describe('Events Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.EventsApi(datadogConfig)
  const toolHandlers = createEventsToolHandlers(apiInstance)

  describe.concurrent('list_events', async () => {
    it('should list events with basic query', async () => {
      const mockHandler = http.get(`${eventsEndpoint}`, async () => {
        return HttpResponse.json({
          events: [
            {
              id: 1234567890,
              title: 'Test event 1',
              text: 'This is a test event for testing the events API',
              dateHappened: 1640995100,
              priority: 'normal',
              tags: ['test:event', 'env:test'],
              host: 'test-host-1',
              source: 'my_app',
              alertType: 'info',
            },
            {
              id: 1234567891,
              title: 'Test event 2',
              text: 'This is another test event for testing the events API',
              dateHappened: 1640995200,
              priority: 'normal',
              tags: ['test:event', 'env:prod'],
              host: 'test-host-2',
              source: 'my_app',
              alertType: 'warning',
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_events', {
          start: 1640995000,
          end: 1640996000,
          limit: 10,
        })
        const response = (await toolHandlers.list_events(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Pagination')
        expect(response.content[1].text).toContain('Categories')
        expect(response.content[2].text).toContain('Events')
        expect(response.content[2].text).toContain('Test event 1')
        expect(response.content[2].text).toContain('Test event 2')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(`${eventsEndpoint}`, async () => {
        return HttpResponse.json({
          events: [],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_events', {
          start: 1640995000,
          end: 1640996000,
        })
        const response = (await toolHandlers.list_events(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Pagination')
        expect(response.content[2].text).toContain('Events: []')
      })()

      server.close()
    })

    it('should handle null response data', async () => {
      const mockHandler = http.get(`${eventsEndpoint}`, async () => {
        return HttpResponse.json({
          events: null,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_events', {
          start: 1640995000,
          end: 1640996000,
        })
        await expect(toolHandlers.list_events(request)).rejects.toThrow(
          'No events data returned',
        )
      })()

      server.close()
    })
  })

  describe.concurrent('get_event', async () => {
    it('should get event details by ID', async () => {
      const mockEventId = 1234567890
      const mockHandler = http.get(
        `${eventsEndpoint}/${mockEventId}`,
        async () => {
          // The API returns directly the event object without wrapping
          return HttpResponse.json({
            id: mockEventId,
            title: 'Test event for get_event',
            text: 'This is a test event for testing the get_event API',
            dateHappened: 1640995100,
            priority: 'normal',
            tags: ['test:event', 'env:test', 'monitor:12345'],
            host: 'test-host-1',
            source: 'my_app',
            alertType: 'info',
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_event', {
          eventId: mockEventId,
        })
        const response = (await toolHandlers.get_event(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Event:')
        expect(response.content[0].text).toContain('Test event for get_event')
        expect(response.content[0].text).toContain(`"id":${mockEventId}`)
        // Should extract the monitor ID from tags
        expect(response.content[2].text).toContain('"monitorId":12345')
      })()

      server.close()
    })

    it('should handle event not found', async () => {
      const mockEventId = 9999999999
      const mockHandler = http.get(
        `${eventsEndpoint}/${mockEventId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Event not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_event', {
          eventId: mockEventId,
        })
        await expect(toolHandlers.get_event(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  describe.concurrent('create_event', async () => {
    it('should create a new event', async () => {
      const mockHandler = http.post(`${eventsEndpoint}`, async () => {
        return HttpResponse.json({
          event: {
            id: 1234567899,
            title: 'New test event',
            text: 'This is a new test event created via the API',
            dateHappened: 1640995300,
            priority: 'normal',
            tags: ['test:event', 'created:api'],
            host: 'test-host-3',
            source: 'api',
            alertType: 'info',
          },
          status: 'ok',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('create_event', {
          title: 'New test event',
          text: 'This is a new test event created via the API',
          dateHappened: 1640995300,
          priority: 'normal',
          tags: ['test:event', 'created:api'],
          host: 'test-host-3',
          alertType: 'info',
        })
        const response = (await toolHandlers.create_event(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Event Created:')
        expect(response.content[0].text).toContain('New test event')
        expect(response.content[0].text).toContain('created via the API')
        expect(response.content[0].text).toContain('1234567899')
      })()

      server.close()
    })

    it('should handle creation failure', async () => {
      const mockHandler = http.post(`${eventsEndpoint}`, async () => {
        return HttpResponse.json(
          { errors: ['Event creation failed'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('create_event', {
          title: 'Failed event',
          text: 'This event should fail to create',
        })
        await expect(toolHandlers.create_event(request)).rejects.toThrow()
      })()

      server.close()
    })
  })
})
