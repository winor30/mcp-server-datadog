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
    it('should retrieve grouped event counts by application name', async () => {
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

    it('should handle custom query filter', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_grouped_event_count', {
          query: '@application.name:Application 1',
          from: 1640995100,
          to: 1640995200,
          groupBy: 'application.name',
        })
        const response = (await toolHandlers.get_rum_grouped_event_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'Session counts (grouped by application.name):',
        )
        expect(response.content[0].text).toContain('"Application 1":2')
      })()

      server.close()
    })

    it('should handle deeper nested path for groupBy', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_grouped_event_count', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          groupBy: 'view.load_time',
        })
        const response = (await toolHandlers.get_rum_grouped_event_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'Session counts (grouped by view.load_time):',
        )
        expect(response.content[0].text).toContain('"123":1')
        expect(response.content[0].text).toContain('"789":1')
        expect(response.content[0].text).toContain('"234":1')
      })()

      server.close()
    })

    it('should handle invalid groupBy path gracefully', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_grouped_event_count', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          groupBy: 'nonexistent.path',
        })
        const response = (await toolHandlers.get_rum_grouped_event_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain(
          'Session counts (grouped by nonexistent.path): {"unknown":3}',
        )
      })()

      server.close()
    })

    it('should handle empty data response', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [],
          })
        }),
      )
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
          'Session counts (grouped by application.name): {}',
        )
      })()

      server.close()
    })

    it('should handle null data response', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: null,
          })
        }),
      )
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_grouped_event_count', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          groupBy: 'application.name',
        })
        await expect(
          toolHandlers.get_rum_grouped_event_count(request),
        ).rejects.toThrow('No RUM events data returned')
      })()

      server.close()
    })

    it('should handle events without attributes field', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [
              {
                id: 'event1',
                // Missing attributes field
              },
              {
                id: 'event2',
                attributes: {
                  // Missing attributes.attributes field
                },
              },
              {
                id: 'event3',
                attributes: {
                  attributes: {
                    application: {
                      name: 'Application 3',
                    },
                    // Missing session field
                  },
                },
              },
            ],
          })
        }),
      )
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
          'Session counts (grouped by application.name): {"Application 3":0}',
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

    it('should use default metric names if not provided', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          // metricNames not provided, should use defaults
        })
        const response = (await toolHandlers.get_rum_page_performance(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain('view.load_time')
        expect(response.content[0].text).toContain(
          'view.first_contentful_paint',
        )
        // Default also includes largest_contentful_paint, but our mock doesn't have this data
        expect(response.content[0].text).toContain(
          'view.largest_contentful_paint',
        )
      })()

      server.close()
    })

    it('should handle custom query filter', async () => {
      const server = getCommonServer()
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '@application.name:Application 1',
          from: 1640995100,
          to: 1640995200,
          metricNames: ['view.load_time'],
        })
        const response = (await toolHandlers.get_rum_page_performance(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain('view.load_time')
      })()

      server.close()
    })

    it('should handle empty data response', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [],
          })
        }),
      )
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

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain(
          '"view.load_time":{"avg":0,"min":0,"max":0,"count":0}',
        )
        expect(response.content[0].text).toContain(
          '"view.first_contentful_paint":{"avg":0,"min":0,"max":0,"count":0}',
        )
      })()

      server.close()
    })

    it('should handle null data response', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: null,
          })
        }),
      )
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          metricNames: ['view.load_time'],
        })
        await expect(
          toolHandlers.get_rum_page_performance(request),
        ).rejects.toThrow('No RUM events data returned')
      })()

      server.close()
    })

    it('should handle events without attributes field', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [
              {
                id: 'event1',
                // Missing attributes field
              },
              {
                id: 'event2',
                attributes: {
                  // Missing attributes.attributes field
                },
              },
              {
                id: 'event3',
                attributes: {
                  attributes: {
                    application: {
                      name: 'Application 3',
                    },
                    // Missing view field with metrics
                  },
                },
              },
            ],
          })
        }),
      )
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

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain(
          '"view.load_time":{"avg":0,"min":0,"max":0,"count":0}',
        )
        expect(response.content[0].text).toContain(
          '"view.first_contentful_paint":{"avg":0,"min":0,"max":0,"count":0}',
        )
      })()

      server.close()
    })

    it('should handle deeply nested metric paths', async () => {
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
                    deep: {
                      nested: {
                        metric: 42,
                      },
                    },
                  },
                },
              },
              {
                id: 'event2',
                attributes: {
                  attributes: {
                    application: {
                      name: 'Application 2',
                    },
                    deep: {
                      nested: {
                        metric: 84,
                      },
                    },
                  },
                },
              },
            ],
          })
        }),
      )
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          metricNames: ['deep.nested.metric'],
        })
        const response = (await toolHandlers.get_rum_page_performance(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain(
          '"deep.nested.metric":{"avg":63,"min":42,"max":84,"count":2}',
        )
      })()

      server.close()
    })

    it('should handle mixed metric availability', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [
              {
                id: 'event1',
                attributes: {
                  attributes: {
                    view: {
                      load_time: 100,
                      // first_contentful_paint is missing
                    },
                  },
                },
              },
              {
                id: 'event2',
                attributes: {
                  attributes: {
                    view: {
                      // load_time is missing
                      first_contentful_paint: 200,
                    },
                  },
                },
              },
            ],
          })
        }),
      )
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

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain(
          '"view.load_time":{"avg":100,"min":100,"max":100,"count":1}',
        )
        expect(response.content[0].text).toContain(
          '"view.first_contentful_paint":{"avg":200,"min":200,"max":200,"count":1}',
        )
      })()

      server.close()
    })

    it('should handle non-numeric values gracefully', async () => {
      const server = setupServer(
        http.get(`${baseUrl}/v2/rum/events`, async () => {
          return HttpResponse.json({
            data: [
              {
                id: 'event1',
                attributes: {
                  attributes: {
                    invalid_metric: 'not-a-number',
                    view: {
                      load_time: 100,
                    },
                  },
                },
              },
            ],
          })
        }),
      )
      await server.boundary(async () => {
        const request = createMockToolRequest('get_rum_page_performance', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          metricNames: ['invalid_metric', 'view.load_time'],
        })
        const response = (await toolHandlers.get_rum_page_performance(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Page performance metrics')
        expect(response.content[0].text).toContain(
          '"invalid_metric":{"avg":0,"min":0,"max":0,"count":0}',
        )
        expect(response.content[0].text).toContain(
          '"view.load_time":{"avg":100,"min":100,"max":100,"count":1}',
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
