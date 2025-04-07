import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createRumToolHandlers } from '../../src/tools/rum/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const getCommonServer = () => {
  const server = setupServer(
    http.get(`${baseUrl}/v2/rum/events`, async () => {
      return HttpResponse.json({
        data: [
          {
            id: 'event1',
            attributes: {
              attributes: {
                application: {
                  name: 'Application 1',
                },
                session: { id: 'sess1' },
                view: {
                  load_time: 123,
                  first_contentful_paint: 456,
                },
              },
            },
          },
          {
            id: 'event2',
            attributes: {
              attributes: {
                application: {
                  name: 'Application 1',
                },
                session: { id: 'sess2' },
                view: {
                  load_time: 789,
                  first_contentful_paint: 101,
                },
              },
            },
          },
          {
            id: 'event3',
            attributes: {
              attributes: {
                application: {
                  name: 'Application 2',
                },
                session: { id: 'sess3' },
                view: {
                  load_time: 234,
                  first_contentful_paint: 567,
                },
              },
            },
          },
        ],
      })
    }),
  )
  return server
}

describe('RUM Tools', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.RUMApi(datadogConfig)
  const toolHandlers = createRumToolHandlers(apiInstance)

  describe.concurrent('get_rum_applications', async () => {
    it('should retrieve RUM applications', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/applications`, async () => {
          return HttpResponse.json({
            data: [
              {
                attributes: {
                  application_id: '7124cba6-8ffe-4122-a644-82c7f4c21ae0',
                  name: 'Application 1',
                  created_at: 1725949945579,
                  created_by_handle: 'rex@rexskz.info',
                  org_id: 1,
                  type: 'browser',
                  updated_at: 1725949945579,
                  updated_by_handle: 'Datadog',
                },
                id: '7124cba6-8ffe-4122-a644-82c7f4c21ae0',
                type: 'rum_application',
              },
            ],
          })
        }),
      )
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_applications', {})
        const response = (await toolHandlers.get_rum_applications(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('RUM applications')
        expect(response.content[0].text).toContain('Application 1')
        expect(response.content[0].text).toContain('rum_application')
      })()

      server.close()
    })
  })

  describe.concurrent('get_rum_events', async () => {
    it('should retrieve RUM events', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_events', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          limit: 10,
        })
        const response = (await toolHandlers.get_rum_events(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('RUM events data')
        expect(response.content[0].text).toContain('event1')
        expect(response.content[0].text).toContain('event2')
        expect(response.content[0].text).toContain('event3')
      })()

      server.close()
    })
  })

  describe.concurrent('get_rum_grouped_event_count', async () => {
    it('should retrieve grouped event counts', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_grouped_event_count', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          groupBy: 'application.name',
        })
        const response = (await toolHandlers.get_rum_grouped_event_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'Session counts (grouped by application.name): {"Application 1":2,"Application 2":1}',
        )
      })()

      server.close()
    })
  })

  describe.concurrent('get_rum_page_performance', async () => {
    it('should retrieve page performance metrics', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          metricNames: ['view.load_time', 'view.first_contentful_paint'],
        })
        const response = (await toolHandlers.get_rum_page_performance(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'Page performance metrics: {"view.load_time":{"avg":382,"min":123,"max":789,"count":3},"view.first_contentful_paint":{"avg":374.6666666666667,"min":101,"max":567,"count":3}}',
        )
      })()

      server.close()
    })
  })

  describe.concurrent('get_rum_page_waterfall', async () => {
    it('should retrieve page waterfall data', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_waterfall', {
          applicationName: 'Application 1',
          sessionId: 'sess1',
        })
        const response = (await toolHandlers.get_rum_page_waterfall(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Waterfall data')
        expect(response.content[0].text).toContain('event1')
        expect(response.content[0].text).toContain('event2')
      })()

      server.close()
    })
  })
})
