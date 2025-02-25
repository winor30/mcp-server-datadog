#!/usr/bin/env node

/**
 * This script sets up the mcp-server-datadog.
 * It initializes an MCP server that integrates with Datadog for incident management.
 * By leveraging MCP, this server can list and retrieve incidents via the Datadog incident API.
 * With a design built for scalability, future integrations with additional Datadog APIs are anticipated.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { log, mcpDatadogVersion } from './utils/helper'
import { INCIDENT_HANDLERS, INCIDENT_TOOLS } from './tools/incident'
import { METRICS_TOOLS, METRICS_HANDLERS } from './tools/metrics'
import { LOGS_TOOLS, LOGS_HANDLERS } from './tools/logs'
import { MONITORS_TOOLS, MONITORS_HANDLERS } from './tools/monitors'
import { DASHBOARDS_TOOLS, DASHBOARDS_HANDLERS } from './tools/dashboards'
import { TRACES_TOOLS, TRACES_HANDLERS } from './tools/traces'
import { ToolHandlers } from './utils/types'

const server = new Server(
  {
    name: 'Datadog MCP Server',
    version: mcpDatadogVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.onerror = (error) => {
  log('error', `Server error: ${error.message}`, error.stack)
}

/**
 * Handler that retrieves the list of available tools in the mcp-server-datadog.
 * Currently, it provides incident management functionalities by integrating with Datadog's incident APIs.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...INCIDENT_TOOLS,
      ...METRICS_TOOLS,
      ...LOGS_TOOLS,
      ...MONITORS_TOOLS,
      ...DASHBOARDS_TOOLS,
      ...TRACES_TOOLS,
    ],
  }
})

const TOOL_HANDLERS: ToolHandlers = {
  ...INCIDENT_HANDLERS,
  ...METRICS_HANDLERS,
  ...LOGS_HANDLERS,
  ...MONITORS_HANDLERS,
  ...DASHBOARDS_HANDLERS,
  ...TRACES_HANDLERS,
}
/**
 * Handler for invoking Datadog-related tools in the mcp-server-datadog.
 * The TOOL_HANDLERS object contains various tools that interact with different Datadog APIs.
 * By specifying the tool name in the request, the LLM can select and utilize the required tool.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (TOOL_HANDLERS[request.params.name]) {
      return await TOOL_HANDLERS[request.params.name](request)
    }
    throw new Error('Unknown tool')
  } catch (unknownError) {
    const error =
      unknownError instanceof Error
        ? unknownError
        : new Error(String(unknownError))
    log(
      'error',
      `Request: ${request.params.name}, ${JSON.stringify(request.params.arguments)} failed`,
      error.message,
      error.stack,
    )
    throw error
  }
})

/**
 * Initializes and starts the mcp-server-datadog using stdio transport,
 * which sends and receives data through standard input and output.
 */
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  log('error', 'Server error:', error)
  process.exit(1)
})
