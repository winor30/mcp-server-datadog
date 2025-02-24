import z from 'zod'
import {
  Result,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

type ToolHandler = (
  request: z.infer<typeof CallToolRequestSchema>,
) => Promise<Result>

export type ToolHandlers<T extends string = string> = Record<T, ToolHandler>

export type ExtendedTool<T extends string = string> = Tool & { name: T }
