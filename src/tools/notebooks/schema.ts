import { z } from 'zod'

export const ListNotebooksZodSchema = z.object({
  authorHandle: z
    .string()
    .optional()
    .describe('Return notebooks created by the given author_handle'),
  excludeAuthorHandle: z
    .string()
    .optional()
    .describe('Return notebooks not created by the given author_handle'),
  start: z
    .number()
    .optional()
    .describe('The index of the first notebook you want returned'),
  count: z
    .number()
    .optional()
    .describe('The number of notebooks to be returned'),
  sortField: z
    .enum(['modified', 'name', 'created'])
    .optional()
    .describe('Sort by field: modified, name, or created'),
  sortDir: z
    .enum(['asc', 'desc'])
    .optional()
    .describe('Sort by direction: asc or desc'),
  query: z
    .string()
    .optional()
    .describe(
      'Return only notebooks with query string in notebook name or author handle',
    ),
  includeCells: z
    .boolean()
    .optional()
    .describe(
      'Value of false excludes the cells and global time for each notebook',
    ),
  isTemplate: z
    .boolean()
    .optional()
    .describe(
      'True value returns only template notebooks. Default is false (returns only non-template notebooks)',
    ),
  type: z
    .string()
    .optional()
    .describe(
      'If type is provided, returns only notebooks with that metadata type',
    ),
})

export const GetNotebookZodSchema = z.object({
  notebookId: z
    .number()
    .describe('Unique ID, assigned when you create the notebook'),
})
