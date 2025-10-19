import { afterEach, vi } from 'vitest'

process.env.DATADOG_API_KEY = 'test-api-key'
process.env.DATADOG_APP_KEY = 'test-app-key'

process.env.DATADOG_EVAL_TIMESTAMP = new Date().toISOString()
// Reset handlers after each test
afterEach(() => {
  // server.resetHandlers()
  vi.clearAllMocks()
})
