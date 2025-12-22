import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createLogsToolHandlers } from '../../src/tools/logs/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl } from '../helpers/datadog'

const logsEndpoint = `${baseUrl}/v2/logs/events/search`

describe('Logs Tool - DATADOG_STORAGE_TIER environment variable', () => {
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

  it('should include storageTier in get_logs when DATADOG_STORAGE_TIER is set to flex', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    process.env.DATADOG_STORAGE_TIER = 'flex'

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [
            {
              id: 'test-id',
              attributes: {
                timestamp: 1640995199999,
                status: 'info',
                message: 'Test log from flex tier',
                service: 'test-service',
              },
              type: 'log',
            },
          ],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test-service',
          from: 1640995100,
          to: 1640995200,
          limit: 10,
        })
        await toolHandlers.get_logs(request)

        // Verify storage_tier was included in the filter (API client serializes storageTier as storage_tier)
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBe('flex')
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })

  it('should include storageTier in get_all_services when DATADOG_STORAGE_TIER is set to indexes', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    process.env.DATADOG_STORAGE_TIER = 'indexes'

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [
            {
              id: 'test-id',
              attributes: {
                timestamp: 1640995199999,
                status: 'info',
                message: 'Test log',
                service: 'test-service',
              },
              type: 'log',
            },
          ],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_all_services', {
          query: '*',
          from: 1640995100,
          to: 1640995200,
          limit: 100,
        })
        await toolHandlers.get_all_services(request)

        // Verify storage_tier was included in the filter (API client serializes storageTier as storage_tier)
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBe('indexes')
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })

  it('should not include storageTier when DATADOG_STORAGE_TIER is not set', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    delete process.env.DATADOG_STORAGE_TIER

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await toolHandlers.get_logs(request)

        // Verify storage_tier was NOT included in the filter
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBeUndefined()
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })

  it('should handle invalid DATADOG_STORAGE_TIER value gracefully', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    process.env.DATADOG_STORAGE_TIER = 'invalid-tier'

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await toolHandlers.get_logs(request)

        // Verify storage_tier was NOT included when invalid value provided
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBeUndefined()
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })

  it('should handle case-insensitive DATADOG_STORAGE_TIER values', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    process.env.DATADOG_STORAGE_TIER = 'FLEX'

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await toolHandlers.get_logs(request)

        // Verify storage_tier was normalized to lowercase
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBe('flex')
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })

  it('should support online-archives storage tier', async () => {
    const originalEnv = process.env.DATADOG_STORAGE_TIER
    process.env.DATADOG_STORAGE_TIER = 'online-archives'

    try {
      let capturedRequestBody: { filter?: { storage_tier?: string } } | null =
        null
      const mockHandler = http.post(logsEndpoint, async ({ request }) => {
        capturedRequestBody = await request.json()
        return HttpResponse.json({
          data: [],
          meta: { page: {} },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_logs', {
          query: 'service:test',
          from: 1640995100,
          to: 1640995200,
        })
        await toolHandlers.get_logs(request)

        // Verify online-archives tier is supported
        expect(capturedRequestBody).toBeDefined()
        expect(capturedRequestBody!.filter).toBeDefined()
        expect(capturedRequestBody!.filter!.storage_tier).toBe(
          'online-archives',
        )
      })()

      server.close()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DATADOG_STORAGE_TIER
      } else {
        process.env.DATADOG_STORAGE_TIER = originalEnv
      }
    }
  })
})
