import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createIncidentToolHandlers } from '../../src/tools/incident/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const incidentsEndpoint = `${baseUrl}/v2/incidents`

describe('Incident Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.IncidentsApi(datadogConfig)
  const toolHandlers = createIncidentToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/incidents/#get-a-list-of-incidents
  describe.concurrent('list_incidents', async () => {
    it('should list incidents with pagination', async () => {
      const mockHandler = http.get(incidentsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'incident-123',
              type: 'incidents',
              attributes: {
                title: 'API Outage',
                created: '2023-01-15T10:00:00.000Z',
                modified: '2023-01-15T11:30:00.000Z',
                status: 'active',
                severity: 'SEV-1',
                customer_impact_scope: 'All API services are down',
                customer_impact_start: '2023-01-15T10:00:00.000Z',
                customer_impacted: true,
              },
              relationships: {
                created_by: {
                  data: {
                    id: 'user-123',
                    type: 'users',
                  },
                },
              },
            },
            {
              id: 'incident-456',
              type: 'incidents',
              attributes: {
                title: 'Database Slowdown',
                created: '2023-01-10T09:00:00.000Z',
                modified: '2023-01-10T12:00:00.000Z',
                status: 'resolved',
                severity: 'SEV-2',
                customer_impact_scope: 'Database queries are slow',
                customer_impact_start: '2023-01-10T09:00:00.000Z',
                customer_impact_end: '2023-01-10T12:00:00.000Z',
                customer_impacted: true,
              },
              relationships: {
                created_by: {
                  data: {
                    id: 'user-456',
                    type: 'users',
                  },
                },
              },
            },
          ],
          meta: {
            pagination: {
              offset: 10,
              size: 20,
              total: 45,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_incidents', {
          pageSize: 20,
          pageOffset: 10,
        })
        const response = (await toolHandlers.list_incidents(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Listed incidents:')
        expect(response.content[0].text).toContain('API Outage')
        expect(response.content[0].text).toContain('Database Slowdown')
        expect(response.content[0].text).toContain('incident-123')
        expect(response.content[0].text).toContain('incident-456')
      })()

      server.close()
    })

    it('should use default pagination parameters if not provided', async () => {
      const mockHandler = http.get(incidentsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'incident-789',
              type: 'incidents',
              attributes: {
                title: 'Network Connectivity Issues',
                status: 'active',
              },
            },
          ],
          meta: {
            pagination: {
              offset: 0,
              size: 10,
              total: 1,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_incidents', {})
        const response = (await toolHandlers.list_incidents(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Listed incidents:')
        expect(response.content[0].text).toContain(
          'Network Connectivity Issues',
        )
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(incidentsEndpoint, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            pagination: {
              offset: 0,
              size: 10,
              total: 0,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_incidents', {})
        const response = (await toolHandlers.list_incidents(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Listed incidents:')
        expect(response.content[0].text).not.toContain('incident-')
      })()

      server.close()
    })

    it('should handle null data response', async () => {
      const mockHandler = http.get(incidentsEndpoint, async () => {
        return HttpResponse.json({
          data: null,
          meta: {
            pagination: {
              offset: 0,
              size: 10,
              total: 0,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_incidents', {})
        await expect(toolHandlers.list_incidents(request)).rejects.toThrow(
          'No incidents data returned',
        )
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(incidentsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_incidents', {})
        await expect(toolHandlers.list_incidents(request)).rejects.toThrow()
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/incidents/#get-incident-details
  describe.concurrent('get_incident', async () => {
    it('should get a specific incident', async () => {
      const incidentId = 'incident-123'
      const specificIncidentEndpoint = `${incidentsEndpoint}/${incidentId}`

      const mockHandler = http.get(specificIncidentEndpoint, async () => {
        return HttpResponse.json({
          data: {
            id: 'incident-123',
            type: 'incidents',
            attributes: {
              title: 'API Outage',
              created: '2023-01-15T10:00:00.000Z',
              modified: '2023-01-15T11:30:00.000Z',
              status: 'active',
              severity: 'SEV-1',
              customer_impact_scope: 'All API services are down',
              customer_impact_start: '2023-01-15T10:00:00.000Z',
              customer_impacted: true,
              fields: {
                summary: 'Complete API outage affecting all customers',
                root_cause: 'Database connection pool exhausted',
                detection_method: 'Monitor alert',
                services: ['api', 'database'],
                teams: ['backend', 'sre'],
              },
              timeline: {
                entries: [
                  {
                    timestamp: '2023-01-15T10:00:00.000Z',
                    content: 'Incident detected',
                    type: 'incident_created',
                  },
                  {
                    timestamp: '2023-01-15T10:05:00.000Z',
                    content: 'Investigation started',
                    type: 'comment',
                  },
                ],
              },
            },
            relationships: {
              created_by: {
                data: {
                  id: 'user-123',
                  type: 'users',
                },
              },
              commander: {
                data: {
                  id: 'user-456',
                  type: 'users',
                },
              },
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_incident', {
          incidentId: 'incident-123',
        })
        const response = (await toolHandlers.get_incident(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Incident:')
        expect(response.content[0].text).toContain('API Outage')
        expect(response.content[0].text).toContain('incident-123')
        expect(response.content[0].text).toContain('SEV-1')
        expect(response.content[0].text).toContain(
          'Database connection pool exhausted',
        )
      })()

      server.close()
    })

    it('should handle incident not found', async () => {
      const incidentId = 'non-existent-incident'
      const specificIncidentEndpoint = `${incidentsEndpoint}/${incidentId}`

      const mockHandler = http.get(specificIncidentEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Incident not found'] },
          { status: 404 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_incident', {
          incidentId: 'non-existent-incident',
        })
        await expect(toolHandlers.get_incident(request)).rejects.toThrow(
          'Incident not found',
        )
      })()

      server.close()
    })

    it('should handle null data response', async () => {
      const incidentId = 'incident-123'
      const specificIncidentEndpoint = `${incidentsEndpoint}/${incidentId}`

      const mockHandler = http.get(specificIncidentEndpoint, async () => {
        return HttpResponse.json({
          data: null,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_incident', {
          incidentId: 'incident-123',
        })
        await expect(toolHandlers.get_incident(request)).rejects.toThrow(
          'No incident data returned',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const incidentId = 'incident-123'
      const specificIncidentEndpoint = `${incidentsEndpoint}/${incidentId}`

      const mockHandler = http.get(specificIncidentEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Internal server error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_incident', {
          incidentId: 'incident-123',
        })
        await expect(toolHandlers.get_incident(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })
})
