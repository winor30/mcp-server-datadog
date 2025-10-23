import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createLogPatternsToolHandlers } from '../../src/tools/log_patterns/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const logsEndpoint = `${baseUrl}/v2/logs/events/search`

describe('Log Patterns Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.LogsApi(datadogConfig)
  const toolHandlers = createLogPatternsToolHandlers(apiInstance)

  describe.concurrent('find_log_patterns', async () => {
    it('should identify common log patterns', async () => {
      // Mock API response with similar log patterns
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'log1',
              attributes: {
                timestamp: 1640995100000,
                message: 'Connection to database established in 15ms',
                service: 'api-service',
              },
              type: 'log',
            },
            {
              id: 'log2',
              attributes: {
                timestamp: 1640995200000,
                message: 'Connection to database established in 25ms',
                service: 'api-service',
              },
              type: 'log',
            },
            {
              id: 'log3',
              attributes: {
                timestamp: 1640995300000,
                message: 'Connection to database established in 18ms',
                service: 'api-service',
              },
              type: 'log',
            },
            {
              id: 'log4',
              attributes: {
                timestamp: 1640995400000,
                message: 'Request completed in 150ms: GET /api/users',
                service: 'api-service',
              },
              type: 'log',
            },
            {
              id: 'log5',
              attributes: {
                timestamp: 1640995500000,
                message: 'Request completed in 120ms: GET /api/products',
                service: 'api-service',
              },
              type: 'log',
            },
          ],
          meta: {
            page: {
              after: null,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('find_log_patterns', {
          from: 1640995000,
          to: 1640996000,
          query: 'service:api-service',
          similarity_threshold: 0.7,
          min_occurrences: 2,
        })
        const response = (await toolHandlers.find_log_patterns(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Status')
        expect(response.content[1].text).toContain('Pagination')
        expect(response.content[2].text).toContain('Patterns')

        // Should find both patterns
        const patternsText = response.content[2].text
        expect(patternsText).toContain('Connection to database established')
        expect(patternsText).toContain('Request completed')
        expect(patternsText).toContain('{{variable}}')
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
        const request = createMockToolRequest('find_log_patterns', {
          from: 1640995000,
          to: 1640996000,
          query: 'service:non-existent',
        })
        const response = (await toolHandlers.find_log_patterns(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Status')
        expect(response.content[0].text).toContain('complete":true')
        expect(response.content[2].text).toContain('Patterns: []')
      })()

      server.close()
    })
  })

  describe.concurrent('extract_error_signatures', async () => {
    it('should categorize error signatures', async () => {
      // Mock API response with error logs
      const mockHandler = http.post(logsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 'err1',
              attributes: {
                timestamp: 1640995100000,
                message: 'Error: Database connection failed: timeout after 30s',
                service: 'api-service',
                status: 'error',
              },
              type: 'log',
            },
            {
              id: 'err2',
              attributes: {
                timestamp: 1640995200000,
                message: 'Error: Database connection failed: timeout after 45s',
                service: 'api-service',
                status: 'error',
              },
              type: 'log',
            },
            {
              id: 'err3',
              attributes: {
                timestamp: 1640995300000,
                message:
                  "TypeError: Cannot read property 'id' of undefined\n at /app/src/users/controller.js:45:12",
                service: 'api-service',
                status: 'error',
              },
              type: 'log',
            },
            {
              id: 'err4',
              attributes: {
                timestamp: 1640995400000,
                message:
                  "TypeError: Cannot read property 'name' of undefined\n at /app/src/users/controller.js:50:10",
                service: 'api-service',
                status: 'error',
              },
              type: 'log',
            },
          ],
          meta: {
            page: {
              after: null,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('extract_error_signatures', {
          from: 1640995000,
          to: 1640996000,
          extract_stack_frames: 1,
        })
        const response = (await toolHandlers.extract_error_signatures(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Status')
        expect(response.content[1].text).toContain('Summary')
        expect(response.content[3].text).toContain('ErrorSignatures')

        // Should identify both error types
        const signaturesText = response.content[3].text
        expect(signaturesText).toContain('Error')
        expect(signaturesText).toContain('TypeError')
        expect(signaturesText).toContain('Database connection failed')
        expect(signaturesText).toContain('Cannot read property')
      })()

      server.close()
    })
  })

  describe.concurrent('detect_anomalous_patterns', async () => {
    it('should detect anomalous log patterns', async () => {
      // Mock API response for analysis period (with unusual patterns)
      const mockAnalysisHandler = http.post(logsEndpoint, async (req) => {
        // Check if this is the analysis period request
        const body = await req.request.json()
        if (body.filter.from === '1640995000000') {
          return HttpResponse.json({
            data: [
              {
                id: 'log1',
                attributes: {
                  timestamp: 1640995100000,
                  message:
                    'Error: Database connection failed: timeout after 30s',
                  service: 'api-service',
                  status: 'error',
                },
              },
              {
                id: 'log2',
                attributes: {
                  timestamp: 1640995200000,
                  message:
                    'Error: Database connection failed: timeout after 45s',
                  service: 'api-service',
                  status: 'error',
                },
              },
              {
                id: 'log3',
                attributes: {
                  timestamp: 1640995300000,
                  message:
                    'Error: Database connection failed: timeout after 30s',
                  service: 'api-service',
                  status: 'error',
                },
              },
              {
                id: 'log4',
                attributes: {
                  timestamp: 1640995400000,
                  message: 'Connection successful to database',
                  service: 'api-service',
                },
              },
            ],
            meta: {
              page: {
                after: null,
              },
            },
          })
        } else {
          // Baseline period (normal behavior)
          return HttpResponse.json({
            data: [
              {
                id: 'blog1',
                attributes: {
                  timestamp: 1640905100000,
                  message: 'Connection successful to database',
                  service: 'api-service',
                },
              },
              {
                id: 'blog2',
                attributes: {
                  timestamp: 1640905200000,
                  message: 'Connection successful to database',
                  service: 'api-service',
                },
              },
              {
                id: 'blog3',
                attributes: {
                  timestamp: 1640905300000,
                  message: 'Connection successful to database',
                  service: 'api-service',
                },
              },
              {
                id: 'blog4',
                attributes: {
                  timestamp: 1640905400000,
                  message:
                    'Error: Database connection failed: timeout after 30s',
                  service: 'api-service',
                  status: 'error',
                },
              },
            ],
            meta: {
              page: {
                after: null,
              },
            },
          })
        }
      })

      const server = setupServer(mockAnalysisHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('detect_anomalous_patterns', {
          from: 1640995000,
          to: 1640996000,
          baseline_from: 1640905000,
          baseline_to: 1640906000,
          query: 'service:api-service',
          sensitivity: 1, // Set to lowest sensitivity to detect more anomalies
        })
        const response = (await toolHandlers.detect_anomalous_patterns(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Status')
        expect(response.content[1].text).toContain('Summary')
        expect(response.content[3].text).toContain('Anomalies')

        // Print all response entries for debugging
        console.log('All response entries:')
        response.content.forEach((content, idx) => {
          console.log(`[${idx}]: ${content.text.substring(0, 200)}...`)
        })

        // Debug the analysis logs to ensure the database connection messages are there
        const analysisLogsText = response.content[4].text
        expect(analysisLogsText).toContain('Database connection failed')
      })()

      server.close()
    })
  })
})
