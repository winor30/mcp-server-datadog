import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createDashboardsToolHandlers } from '../../src/tools/dashboards/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const dashboardEndpoint = `${baseUrl}/v1/dashboard`

describe('Dashboards Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.DashboardsApi(datadogConfig)
  const toolHandlers = createDashboardsToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/dashboards/#get-all-dashboards
  describe.concurrent('list_dashboards', async () => {
    it('should list dashboards', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json({
          dashboards: [
            {
              id: 'q5j-nti-fv6',
              type: 'host_timeboard',
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test name',
          tags: ['test_tag'],
        })
        const response = (await toolHandlers.list_dashboards(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Dashboards')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy authentication error'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy authentication error',
        )
      })()

      server.close()
    })

    it('should handle too many requests', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy too many requests'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy too many requests',
        )
      })()

      server.close()
    })

    it('should handle unknown errors', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy unknown error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy unknown error',
        )
      })()

      server.close()
    })
  })
})
