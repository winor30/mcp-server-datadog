import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createHostsToolHandlers } from '../../src/tools/hosts/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const hostsBaseEndpoint = `${baseUrl}/v1/hosts`
const hostBaseEndpoint = `${baseUrl}/v1/host`
const hostTotalsEndpoint = `${hostsBaseEndpoint}/totals`

describe('Hosts Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.HostsApi(datadogConfig)
  const toolHandlers = createHostsToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/hosts/#get-all-hosts
  describe.concurrent('list_hosts', async () => {
    it('should list hosts with filters', async () => {
      const mockHandler = http.get(hostsBaseEndpoint, async () => {
        return HttpResponse.json({
          host_list: [
            {
              name: 'web-server-01',
              id: 12345,
              aliases: ['web-server-01.example.com'],
              apps: ['nginx', 'redis'],
              is_muted: false,
              last_reported_time: 1640995100,
              meta: {
                platform: 'linux',
                agent_version: '7.36.1',
                socket_hostname: 'web-server-01',
              },
              metrics: {
                load: 0.5,
                cpu: 45.6,
                memory: 78.2,
              },
              sources: ['agent'],
              up: true,
            },
            {
              name: 'db-server-01',
              id: 67890,
              aliases: ['db-server-01.example.com'],
              apps: ['postgres'],
              is_muted: true,
              last_reported_time: 1640995000,
              meta: {
                platform: 'linux',
                agent_version: '7.36.1',
                socket_hostname: 'db-server-01',
              },
              metrics: {
                load: 1.2,
                cpu: 78.3,
                memory: 92.1,
              },
              sources: ['agent'],
              up: true,
            },
          ],
          total_matching: 2,
          total_returned: 2,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_hosts', {
          filter: 'env:production',
          sort_field: 'status',
          sort_dir: 'desc',
          include_hosts_metadata: true,
        })
        const response = (await toolHandlers.list_hosts(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Hosts:')
        expect(response.content[0].text).toContain('web-server-01')
        expect(response.content[0].text).toContain('db-server-01')
        expect(response.content[0].text).toContain('postgres')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(hostsBaseEndpoint, async () => {
        return HttpResponse.json({
          host_list: [],
          total_matching: 0,
          total_returned: 0,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_hosts', {
          filter: 'non-existent:value',
        })
        const response = (await toolHandlers.list_hosts(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Hosts: []')
      })()

      server.close()
    })

    it('should handle missing host_list', async () => {
      const mockHandler = http.get(hostsBaseEndpoint, async () => {
        return HttpResponse.json({
          total_matching: 0,
          total_returned: 0,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_hosts', {})
        await expect(toolHandlers.list_hosts(request)).rejects.toThrow(
          'No hosts data returned',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(hostsBaseEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_hosts', {})
        await expect(toolHandlers.list_hosts(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/hosts/#get-the-total-number-of-active-hosts
  describe.concurrent('get_active_hosts_count', async () => {
    it('should get active hosts count', async () => {
      const mockHandler = http.get(hostTotalsEndpoint, async () => {
        return HttpResponse.json({
          total_up: 512,
          total_active: 520,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_active_hosts_count', {
          from: 3600,
        })
        const response = (await toolHandlers.get_active_hosts_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('total_active')
        expect(response.content[0].text).toContain('520')
        expect(response.content[0].text).toContain('total_up')
        expect(response.content[0].text).toContain('512')
      })()

      server.close()
    })

    it('should use default from value if not provided', async () => {
      const mockHandler = http.get(hostTotalsEndpoint, async () => {
        return HttpResponse.json({
          total_up: 510,
          total_active: 518,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_active_hosts_count', {})
        const response = (await toolHandlers.get_active_hosts_count(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('518')
        expect(response.content[0].text).toContain('510')
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const mockHandler = http.get(hostTotalsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Internal server error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_active_hosts_count', {})
        await expect(
          toolHandlers.get_active_hosts_count(request),
        ).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/hosts/#mute-a-host
  describe.concurrent('mute_host', async () => {
    it('should mute a host', async () => {
      const mockHandler = http.post(
        `${hostBaseEndpoint}/:hostname/mute`,
        async ({ params }) => {
          return HttpResponse.json({
            action: 'muted',
            hostname: params.hostname,
            message: 'Maintenance in progress',
            end: 1641095100,
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('mute_host', {
          hostname: 'test-host',
          message: 'Maintenance in progress',
          end: 1641095100,
          override: true,
        })
        const response = (await toolHandlers.mute_host(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('success')
        expect(response.content[0].text).toContain('test-host')
        expect(response.content[0].text).toContain('Maintenance in progress')
      })()

      server.close()
    })

    it('should handle host not found', async () => {
      const mockHandler = http.post(
        `${hostBaseEndpoint}/:hostname/mute`,
        async () => {
          return HttpResponse.json(
            { errors: ['Host not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('mute_host', {
          hostname: 'non-existent-host',
        })
        await expect(toolHandlers.mute_host(request)).rejects.toThrow(
          'Host not found',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/hosts/#unmute-a-host
  describe.concurrent('unmute_host', async () => {
    it('should unmute a host', async () => {
      const mockHandler = http.post(
        `${hostBaseEndpoint}/:hostname/unmute`,
        async ({ params }) => {
          return HttpResponse.json({
            action: 'unmuted',
            hostname: params.hostname,
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('unmute_host', {
          hostname: 'test-host',
        })
        const response = (await toolHandlers.unmute_host(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('success')
        expect(response.content[0].text).toContain('test-host')
        expect(response.content[0].text).toContain('unmuted')
      })()

      server.close()
    })

    it('should handle host not found', async () => {
      const mockHandler = http.post(
        `${hostBaseEndpoint}/:hostname/unmute`,
        async () => {
          return HttpResponse.json(
            { errors: ['Host not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('unmute_host', {
          hostname: 'non-existent-host',
        })
        await expect(toolHandlers.unmute_host(request)).rejects.toThrow(
          'Host not found',
        )
      })()

      server.close()
    })

    it('should handle host already unmuted', async () => {
      const mockHandler = http.post(
        `${hostBaseEndpoint}/:hostname/unmute`,
        async () => {
          return HttpResponse.json(
            { errors: ['Host is not muted'] },
            { status: 400 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('unmute_host', {
          hostname: 'already-unmuted-host',
        })
        await expect(toolHandlers.unmute_host(request)).rejects.toThrow(
          'Host is not muted',
        )
      })()

      server.close()
    })
  })
})
