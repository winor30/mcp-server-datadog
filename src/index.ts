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
import { INVESTIGATION_CHAINS } from './utils/investigation_chains'
import { detectChain, executeChain } from './utils/chain_executor'
import { INCIDENT_TOOLS, createIncidentToolHandlers } from './tools/incident'
import { METRICS_TOOLS, createMetricsToolHandlers } from './tools/metrics'
import { LOGS_TOOLS, createLogsToolHandlers } from './tools/logs'
import { MONITORS_TOOLS, createMonitorsToolHandlers } from './tools/monitors'
import {
  DASHBOARDS_TOOLS,
  createDashboardsToolHandlers,
} from './tools/dashboards'
import { TRACES_TOOLS, createTracesToolHandlers } from './tools/traces'
import { HOSTS_TOOLS, createHostsToolHandlers } from './tools/hosts'
import { ToolHandlers } from './utils/types'
import { createDatadogConfig } from './utils/datadog'
import { createDowntimesToolHandlers, DOWNTIMES_TOOLS } from './tools/downtimes'
import { createRumToolHandlers, RUM_TOOLS } from './tools/rum'
import { ANOMALY_TOOLS, createAnomalyToolHandlers } from './tools/anomaly'
import { EVENTS_TOOLS, createEventsToolHandlers } from './tools/events'
import { SLO_TOOLS, createSLOToolHandlers } from './tools/slo'
import {
  LOG_PATTERNS_TOOLS,
  createLogPatternsToolHandlers,
} from './tools/log_patterns'
import { META_TOOLS, createMetaToolHandlers } from './tools/meta'
import { v2, v1 } from '@datadog/datadog-api-client'

const server = new Server(
  {
    name: 'Datadog MCP Server',
    version: mcpDatadogVersion,
  },
  {
    capabilities: {
      tools: {},
    },
    // Note: systemPrompt has been removed as it's not a valid option in ServerOptions
    // The RCA system prompt should be handled differently
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
      ...HOSTS_TOOLS,
      ...DOWNTIMES_TOOLS,
      ...RUM_TOOLS,
      ...ANOMALY_TOOLS,
      ...EVENTS_TOOLS,
      ...SLO_TOOLS,
      ...LOG_PATTERNS_TOOLS,
      ...META_TOOLS,
    ],
  }
})

if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
  throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
}

const datadogConfig = createDatadogConfig({
  apiKeyAuth: process.env.DATADOG_API_KEY,
  appKeyAuth: process.env.DATADOG_APP_KEY,
  site: process.env.DATADOG_SITE,
  subdomain: process.env.DATADOG_SUBDOMAIN,
})

const TOOL_HANDLERS: ToolHandlers = {
  ...createIncidentToolHandlers(new v2.IncidentsApi(datadogConfig)),
  ...createMetricsToolHandlers(new v1.MetricsApi(datadogConfig)),
  ...createLogsToolHandlers(new v2.LogsApi(datadogConfig)),
  ...createMonitorsToolHandlers(
    new v1.MonitorsApi(datadogConfig),
    new v1.EventsApi(datadogConfig),
  ),
  ...createDashboardsToolHandlers(new v1.DashboardsApi(datadogConfig)),
  ...createTracesToolHandlers(new v2.SpansApi(datadogConfig)),
  ...createHostsToolHandlers(new v1.HostsApi(datadogConfig)),
  ...createDowntimesToolHandlers(new v1.DowntimesApi(datadogConfig)),
  ...createRumToolHandlers(new v2.RUMApi(datadogConfig)),
  ...createAnomalyToolHandlers(new v1.MetricsApi(datadogConfig)),
  ...createEventsToolHandlers(new v1.EventsApi(datadogConfig)),
  ...createSLOToolHandlers(new v1.ServiceLevelObjectivesApi(datadogConfig)),
  ...createLogPatternsToolHandlers(new v2.LogsApi(datadogConfig)),
  ...createMetaToolHandlers(),
}
/**
 * Handler for invoking Datadog-related tools in the mcp-server-datadog.
 * The TOOL_HANDLERS object contains various tools that interact with different Datadog APIs.
 * By specifying the tool name in the request, the LLM can select and utilize the required tool.
 *
 * Special handling is provided for investigation chain execution.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // Special handling for investigation chains
    if (request.params.name === 'execute_investigation_chain') {
      // Use type assertion to properly type the arguments
      const args = request.params.arguments as {
        chainId: string
        initialVariables?: Record<string, unknown>
      }
      const chainId = args.chainId
      const initialVariables = args.initialVariables

      if (!chainId || !INVESTIGATION_CHAINS[chainId]) {
        throw new Error(`Invalid or missing chain ID: ${chainId}`)
      }

      // Execute the investigation chain
      log('info', `Executing investigation chain: ${chainId}`)
      const context = await executeChain(chainId, TOOL_HANDLERS, {
        initialVariables,
        continueOnFailure: true,
        mode: 'sequential',
      })

      // Format the results for return
      const results = context.results.map((result) => ({
        step: result.stepName,
        tool: result.toolName,
        success: result.success,
        duration: `${result.duration}ms`,
        ...(result.error ? { error: result.error } : {}),
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Investigation Chain: ${context.chainName}`,
          },
          {
            type: 'text',
            text: `Summary: ${JSON.stringify({
              chainId: context.chainId,
              totalSteps: context.totalSteps,
              completedSteps: context.completedSteps,
              failedSteps: context.failedSteps,
              executionTime: `${Date.now() - context.startTime}ms`,
            })}`,
          },
          {
            type: 'text',
            text: `Variables: ${JSON.stringify(context.variables)}`,
          },
          {
            type: 'text',
            text: `Results: ${JSON.stringify(results)}`,
          },
        ],
      }
    }

    // Special handling for detecting and auto-executing chains
    if (request.params.name === 'detect_and_execute_chain') {
      // Use type assertion to properly type the arguments
      const args = request.params.arguments as {
        userInput: string
      }
      const userInput = args.userInput

      if (!userInput) {
        throw new Error('Missing user input for chain detection')
      }

      // Detect the appropriate chain
      const chainInfo = detectChain(userInput)

      if (!chainInfo) {
        return {
          content: [
            {
              type: 'text',
              text: `No investigation chain detected for this query. Please try a more specific request.`,
            },
          ],
        }
      }

      // Execute the detected chain
      log('info', `Auto-executing investigation chain: ${chainInfo.chainId}`)
      const context = await executeChain(chainInfo.chainId, TOOL_HANDLERS, {
        initialVariables: chainInfo.initialVariables,
        continueOnFailure: true,
        mode: 'sequential',
      })

      // Format the results for return
      const results = context.results.map((result) => ({
        step: result.stepName,
        tool: result.toolName,
        success: result.success,
        duration: `${result.duration}ms`,
        ...(result.error ? { error: result.error } : {}),
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Investigation Chain: ${context.chainName}`,
          },
          {
            type: 'text',
            text: `Summary: ${JSON.stringify({
              chainId: context.chainId,
              totalSteps: context.totalSteps,
              completedSteps: context.completedSteps,
              failedSteps: context.failedSteps,
              executionTime: `${Date.now() - context.startTime}ms`,
            })}`,
          },
          {
            type: 'text',
            text: `Variables: ${JSON.stringify(context.variables)}`,
          },
          {
            type: 'text',
            text: `Results: ${JSON.stringify(results)}`,
          },
        ],
      }
    }

    // Handle regular tool calls
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
