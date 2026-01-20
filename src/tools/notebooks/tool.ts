import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetNotebookZodSchema, ListNotebooksZodSchema } from './schema'

type NotebooksToolName = 'list_notebooks' | 'get_notebook'
type NotebooksTool = ExtendedTool<NotebooksToolName>

export const NOTEBOOKS_TOOLS: NotebooksTool[] = [
  createToolSchema(
    ListNotebooksZodSchema,
    'list_notebooks',
    'Get list of notebooks from Datadog',
  ),
  createToolSchema(
    GetNotebookZodSchema,
    'get_notebook',
    'Get a notebook from Datadog',
  ),
] as const

type NotebooksToolHandlers = ToolHandlers<NotebooksToolName>

export const createNotebooksToolHandlers = (
  apiInstance: v1.NotebooksApi,
): NotebooksToolHandlers => {
  return {
    list_notebooks: async (request) => {
      const {
        authorHandle,
        excludeAuthorHandle,
        start,
        count,
        sortField,
        sortDir,
        query,
        includeCells,
        isTemplate,
        type,
      } = ListNotebooksZodSchema.parse(request.params.arguments)

      const response = await apiInstance.listNotebooks({
        authorHandle,
        excludeAuthorHandle,
        start,
        count,
        sortField,
        sortDir,
        query,
        includeCells,
        isTemplate,
        type,
      })

      if (!response.data) {
        throw new Error('No notebooks data returned')
      }

      const notebooks = response.data.map((notebook) => ({
        ...notebook,
        url: `https://app.datadoghq.com/notebook/${notebook.id}`,
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Notebooks: ${JSON.stringify(notebooks)}`,
          },
        ],
      }
    },
    get_notebook: async (request) => {
      const { notebookId } = GetNotebookZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getNotebook({
        notebookId,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Notebook: ${JSON.stringify(response)}`,
          },
        ],
      }
    },
  }
}
