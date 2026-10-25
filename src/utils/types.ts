import {
  Result,
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

type ToolHandler = (request: CallToolRequest) => Promise<Result>

export type ToolHandlers<T extends string = string> = Record<T, ToolHandler>

export type ExtendedTool<T extends string = string> = Tool & { name: T }
