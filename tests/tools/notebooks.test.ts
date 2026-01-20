import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createNotebooksToolHandlers } from '../../src/tools/notebooks/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const notebookEndpoint = `${baseUrl}/v1/notebooks`

describe('Notebooks Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.NotebooksApi(datadogConfig)
  const toolHandlers = createNotebooksToolHandlers(apiInstance)

  // https://docs.datadoghq.com/api/latest/notebooks/#get-all-notebooks
  describe.concurrent('list_notebooks', async () => {
    it('should list notebooks', async () => {
      const mockHandler = http.get(notebookEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 123456,
              type: 'notebooks',
              attributes: {
                name: 'Test Notebook',
                author: {
                  handle: 'test@example.com',
                },
                created: '2023-01-01T00:00:00Z',
                modified: '2023-01-02T00:00:00Z',
              },
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {
          query: 'test',
        })
        const response = (await toolHandlers.list_notebooks(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Notebooks')
        expect(response.content[0].text).toContain('123456')
        expect(response.content[0].text).toContain(
          'https://app.datadoghq.com/notebook/123456',
        )
      })()

      server.close()
    })

    it('should list notebooks with all filter options', async () => {
      const mockHandler = http.get(notebookEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 789,
              type: 'notebooks',
              attributes: {
                name: 'Filtered Notebook',
              },
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {
          authorHandle: 'author@example.com',
          excludeAuthorHandle: 'exclude@example.com',
          start: 0,
          count: 10,
          sortField: 'modified',
          sortDir: 'desc',
          query: 'filtered',
          includeCells: false,
          isTemplate: false,
          type: 'investigation',
        })
        const response = (await toolHandlers.list_notebooks(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Notebooks')
        expect(response.content[0].text).toContain('789')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(notebookEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy authentication error'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {})
        await expect(toolHandlers.list_notebooks(request)).rejects.toThrow(
          'dummy authentication error',
        )
      })()

      server.close()
    })

    it('should handle too many requests', async () => {
      const mockHandler = http.get(notebookEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy too many requests'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {})
        await expect(toolHandlers.list_notebooks(request)).rejects.toThrow(
          'dummy too many requests',
        )
      })()

      server.close()
    })

    it('should handle unknown errors', async () => {
      const mockHandler = http.get(notebookEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy unknown error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {})
        await expect(toolHandlers.list_notebooks(request)).rejects.toThrow(
          'dummy unknown error',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/notebooks/#get-a-notebook
  describe.concurrent('get_notebook', async () => {
    it('should get a notebook', async () => {
      const notebookId = 123456789
      const mockHandler = http.get(
        `${notebookEndpoint}/${notebookId}`,
        async () => {
          return HttpResponse.json({
            data: {
              id: 123456789,
              type: 'notebooks',
              attributes: {
                name: 'Test Notebook',
                author: {
                  handle: 'test@example.com',
                },
                cells: [
                  {
                    id: 'cell1',
                    type: 'notebook_cells',
                    attributes: {
                      definition: {
                        type: 'markdown',
                        text: '# Hello World',
                      },
                    },
                  },
                ],
                created: '2023-01-01T00:00:00Z',
                modified: '2023-01-02T00:00:00Z',
                time: {
                  live_span: '1h',
                },
              },
            },
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_notebook', {
          notebookId,
        })
        const response = (await toolHandlers.get_notebook(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Notebook')
        expect(response.content[0].text).toContain('123456789')
        expect(response.content[0].text).toContain('Test Notebook')
      })()

      server.close()
    })

    it('should handle not found errors', async () => {
      const notebookId = 999999999
      const mockHandler = http.get(
        `${notebookEndpoint}/${notebookId}`,
        async () => {
          return HttpResponse.json({ errors: ['Not found'] }, { status: 404 })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_notebook', {
          notebookId,
        })
        await expect(toolHandlers.get_notebook(request)).rejects.toThrow(
          'Not found',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const notebookId = 123456789
      const mockHandler = http.get(
        `${notebookEndpoint}/${notebookId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Internal server error'] },
            { status: 500 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_notebook', {
          notebookId,
        })
        await expect(toolHandlers.get_notebook(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })
})
