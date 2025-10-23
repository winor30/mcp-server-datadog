import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetLogsZodSchema, GetAllServicesZodSchema } from './schema'
import { log, parseRelativeTimeInQuery } from '../../utils/helper'

/**
 * Executes a function with a timeout
 * @param func Function to execute
 * @param timeoutMs Timeout in milliseconds
 * @param defaultResult Default result to return if timeout occurs
 * @returns Promise resolving to the function result or default result on timeout
 */
async function executeWithTimeout<T>(
  func: () => Promise<T>,
  timeoutMs: number,
  defaultResult: T,
): Promise<{ result: T; timedOut: boolean }> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<{ result: T; timedOut: true }>(
    (resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ result: defaultResult, timedOut: true })
      }, timeoutMs)
    },
  )

  try {
    const result = await Promise.race([
      func().then((result) => ({ result, timedOut: false })),
      timeoutPromise,
    ])

    return result
  } finally {
    clearTimeout(timeoutId!)
  }
}

type LogsToolName = 'get_logs' | 'get_all_services'
type LogsTool = ExtendedTool<LogsToolName>

export const LOGS_TOOLS: LogsTool[] = [
  createToolSchema(
    GetLogsZodSchema,
    'get_logs',
    'Search and retrieve logs from Datadog or get a specific log by ID. ' +
      'For a specific log ID, use the "id" parameter separately, not in the query string. ' +
      'When fetching by ID, ALWAYS include the EXACT original query and time range.',
  ),
  createToolSchema(
    GetAllServicesZodSchema,
    'get_all_services',
    'Extract all unique service names from logs',
  ),
] as const

type LogsToolHandlers = ToolHandlers<LogsToolName>

export const createLogsToolHandlers = (
  apiInstance: v2.LogsApi,
): LogsToolHandlers => ({
  /**
   * Get logs from Datadog or retrieve a specific log by ID.
   *
   * This handler supports two main use cases:
   * 1. Search for logs using query filters and time range
   * 2. Retrieve a specific log by ID while maintaining search context
   *
   * To retrieve a specific log by ID, provide:
   * - The log ID as the 'id' parameter (NOT in the query string)
   * - The original search context (from, to, query) for proper filtering
   * - Set 'full' to true to get complete log details
   *
   * IMPORTANT EXAMPLE:
   *
   * Original search:
   * datadog:get_logs (MCP)(from: 1746103797, to: 1746190197, query: "env:prod \"Indexing to ES failed\"", limit: 5)
   *
   * Correct log retrieval:
   * datadog:get_logs (MCP)(
   *   id: "AwAAAZaR...",
   *   from: 1746103797,
   *   to: 1746190197,
   *   query: "env:prod \"Indexing to ES failed\"",  // Copy EXACTLY - including all nested quotes!
   *   full: true
   * )
   *
   * INCORRECT (will fail):
   * datadog:get_logs (MCP)(
   *   id: "AwAAAZaR...",
   *   from: 1746103797,
   *   to: 1746190197,
   *   query: "env:prod",  // WRONG - not the complete original query!
   *   full: true
   * )
   */
  get_logs: async (request) => {
    // First parse the original parameters
    const {
      query: initialQuery,
      from: initialFrom,
      to: initialTo,
      limit,
      cursor,
      compact,
      id,
      full,
      max_processing_time,
    } = GetLogsZodSchema.parse(request.params.arguments)

    // Use let for variables that will be modified
    let query = initialQuery
    let from = initialFrom
    let to = initialTo

    // Set timeout for the entire operation
    const startTime = Date.now()
    const timeoutMs = max_processing_time

    // Check if there are relative time expressions in the query and adjust timestamps if needed
    // This handles both incorrect timestamps and natural language relative time expressions
    if (!id) {
      // Don't apply time adjustment when retrieving a specific log by ID
      // First, try to parse relative time expressions from the query
      const adjustedTime = parseRelativeTimeInQuery(query, from, to)

      // Special case to handle empty query with possibly outdated timestamps
      if (!adjustedTime.wasAdjusted && (!query || query.trim() === '')) {
        // For empty queries, always verify timestamps are current
        const now = Math.floor(Date.now() / 1000)

        // If timestamps differ by more than a day or are from previous year, auto-correct
        if (to && Math.abs(now - to) > 86400) {
          const toDate = new Date(to * 1000)
          const currentYear = new Date().getFullYear()

          if (toDate.getFullYear() < currentYear) {
            // Auto-correct timestamps from previous year
            from = now - 3600 // Default to past hour
            to = now
            log(
              'info',
              `Auto-corrected timestamps from ${toDate.getFullYear()} to current year ${currentYear} (empty query)`,
            )
            adjustedTime.wasAdjusted = true
            adjustedTime.from = from
            adjustedTime.to = to
          }
        }
      }

      if (adjustedTime.wasAdjusted) {
        from = adjustedTime.from
        to = adjustedTime.to

        // Remove the relative time expression from the query to prevent confusion
        // Define regex for all time expressions we want to remove from the query
        const timeExpressions = [
          // past/last X minute(s)/hour(s)/day(s)/week(s)/month(s)
          { regex: /(past|last)\s+(\d+)\s+minute[s]?/i },
          { regex: /(past|last)\s+(\d+)\s+hour[s]?/i },
          { regex: /(past|last)\s+(\d+)\s+day[s]?/i },
          { regex: /(past|last)\s+(\d+)\s+week[s]?/i },
          { regex: /(past|last)\s+(\d+)\s+month[s]?/i },

          // X minute(s)/hour(s)/day(s)/week(s)/month(s) ago
          { regex: /(\d+)\s+minute[s]?\s+ago/i },
          { regex: /(\d+)\s+hour[s]?\s+ago/i },
          { regex: /(\d+)\s+day[s]?\s+ago/i },
          { regex: /(\d+)\s+week[s]?\s+ago/i },
          { regex: /(\d+)\s+month[s]?\s+ago/i },

          // past/last hour/day/week/month (implied 1)
          { regex: /(past|last)\s+hour/i },
          { regex: /(past|last)\s+day/i },
          { regex: /(past|last)\s+week/i },
          { regex: /(past|last)\s+month/i },

          // Special cases
          { regex: /an?\s+hour\s+ago/i },
          { regex: /a\s+day\s+ago/i },
          { regex: /a\s+week\s+ago/i },
          { regex: /a\s+month\s+ago/i },
          { regex: /today/i },
          { regex: /yesterday/i },
        ]

        // Remove time expressions from the query
        timeExpressions.forEach((expr) => {
          query = query.replace(expr.regex, '').trim()
        })

        // Clean up any leftover operators
        query = query
          .replace(/^\s*AND\s+/i, '')
          .replace(/\s+AND\s*$/i, '')
          .trim()

        log('info', `Adjusted query: "${query}"`)
      }
    }

    try {
      // Wrap all API calls in a timeout to avoid hanging
      const { result: response, timedOut } = await executeWithTimeout(
        async () => {
          // Special handling for retrieving a single log by ID
          if (id) {
            // Datadog API doesn't have a direct method to get a log by ID,
            // so we use the listLogs endpoint with a query for the specific ID

            // Set reasonable defaults for time range if not provided
            const effectiveFrom =
              from || Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60 // 30 days ago if not specified
            const effectiveTo = to || Math.floor(Date.now() / 1000) // now if not specified

            // IMPORTANT: When retrieving by ID, we need to preserve the original query exactly
            // and add the ID filter separately - NOT modify the original query
            // This is crucial for finding the correct log in Datadog's database
            let combinedQuery = `id:${id}`

            // Only add the original query if it's not empty
            if (query && query.trim() !== '') {
              combinedQuery = `${query} AND id:${id}`
            }

            const response = await apiInstance.listLogs({
              body: {
                filter: {
                  query: combinedQuery,
                  // Use the original time range or fall back to defaults
                  from: `${effectiveFrom * 1000}`,
                  to: `${effectiveTo * 1000}`,
                },
                page: {
                  limit: 1,
                },
              },
            })

            return {
              singleLogResponse: response,
              effectiveFrom,
              effectiveTo,
              combinedQuery,
            }
          }

          // Standard logs retrieval with filtering
          const response = await apiInstance.listLogs({
            body: {
              filter: {
                query,
                // `from` and `to` are in epoch seconds, but the Datadog API expects milliseconds
                from: `${from * 1000}`,
                to: `${to * 1000}`,
              },
              page: {
                limit,
                cursor,
              },
              sort: '-timestamp',
            },
          })

          return { standardResponse: response }
        },
        timeoutMs,
        { timedOut: true }, // Default empty result structure if timeout occurs
      )

      // Handle timeout
      if (timedOut) {
        return {
          content: [
            {
              type: 'text',
              text: `The request timed out after ${timeoutMs / 1000} seconds. Please try with a more specific query or a shorter time range.`,
            },
          ],
        }
      }

      // Process the result based on whether it was a single log or standard query
      if ('singleLogResponse' in response) {
        const { singleLogResponse, effectiveFrom, effectiveTo, combinedQuery } =
          response

        if (!singleLogResponse.data || singleLogResponse.data.length === 0) {
          throw new Error(`Log with ID ${id} not found`)
        }

        const logEntry = singleLogResponse.data[0]

        // Create a response object that includes the query context
        const responseObj = {
          log: logEntry,
          context: {
            // Original parameters - these are what the user should use in subsequent related queries
            query: query || '',
            from: effectiveFrom,
            to: effectiveTo,
            // For debugging/informational purposes
            combinedQuery,
          },
        }

        return {
          content: [
            {
              type: 'text',
              text: `Log Detail: ${JSON.stringify(responseObj)}`,
            },
          ],
        }
      }

      // Handle standard response
      const standardResponse = response.standardResponse

      if (!standardResponse.data || standardResponse.data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No logs were found matching your query criteria.',
            },
          ],
        }
      }

      // Extract next cursor if available
      const nextCursor = standardResponse.meta?.page?.after || null

      // Process log data based on compact/full settings
      let logs

      if (full) {
        // Return all log data without any truncation or simplification
        logs = standardResponse.data
      } else if (compact) {
        // Create a simplified and compact representation of logs
        logs = standardResponse.data.map((log) => {
          // Extract the most important fields only to reduce payload size
          const simplifiedLog = {
            id: log.id,
            timestamp: log.attributes?.timestamp,
            message: log.attributes?.message
              ? // Truncate long messages
                log.attributes.message.substring(0, 200) +
                (log.attributes.message.length > 200 ? '...' : '')
              : null,
            status: log.attributes?.status,
            service: log.attributes?.service,
            host: log.attributes?.host,
          }

          // Add error info if available but keep it minimal
          if (log.attributes?.error) {
            simplifiedLog['error'] =
              typeof log.attributes.error === 'object'
                ? {
                    kind: log.attributes.error.kind,
                    message: log.attributes.error.message?.substring(0, 100),
                  }
                : log.attributes.error.toString().substring(0, 100)
          }

          return simplifiedLog
        })
      } else {
        // Semi-detailed mode - include more fields but still do some truncation
        logs = standardResponse.data.map((log) => {
          const enhancedLog = {
            id: log.id,
            timestamp: log.attributes?.timestamp,
            message: log.attributes?.message,
            status: log.attributes?.status,
            service: log.attributes?.service,
            host: log.attributes?.host,
            tags: log.attributes?.tags,
            attributes: { ...log.attributes },
          }

          // Remove any potentially large fields that might cause the response to be too big
          if (enhancedLog.attributes) {
            // Keep error information but ensure it's not too large
            if (
              enhancedLog.attributes.error &&
              typeof enhancedLog.attributes.error === 'object'
            ) {
              enhancedLog.attributes.error = {
                kind: enhancedLog.attributes.error.kind,
                message: enhancedLog.attributes.error.message,
                stack: enhancedLog.attributes.error.stack
                  ? enhancedLog.attributes.error.stack.substring(0, 500)
                  : undefined,
              }
            }

            // Remove any additional large data fields
            delete enhancedLog.attributes._raw
            delete enhancedLog.attributes.stack_trace
          }

          return enhancedLog
        })
      }

      // Add processing info including time taken
      const processingTime = Date.now() - startTime
      const processingInfo = {
        processingTimeMs: processingTime,
        timedOut: false,
      }

      // Create pagination info with additional context for finding specific logs
      const pagination = {
        hasMore: !!nextCursor,
        nextCursor: nextCursor,
        returnedLogs: logs.length,
        timeRange: {
          from: from,
          to: to,
          from_formatted: new Date(from * 1000).toISOString(),
          to_formatted: new Date(to * 1000).toISOString(),
        },
        // Include instructions for fetching full log details
        getLogDetailsHint:
          logs.length > 0
            ? `To get detailed information for a specific log, use this same tool with parameters: id: "<log_id>", query: "${query}", from: ${from}, to: ${to}, full: true`
            : null,
      }

      return {
        content: [
          {
            type: 'text',
            text: `ProcessingInfo: ${JSON.stringify(processingInfo)}`,
          },
          {
            type: 'text',
            text: `Logs data: ${JSON.stringify(logs)}`,
          },
          {
            type: 'text',
            text: `Pagination: ${JSON.stringify(pagination)}`,
          },
        ],
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
      throw new Error(
        `Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  },

  // The get_log_by_id functionality has been integrated into the get_logs handler

  get_all_services: async (request) => {
    // First parse the original parameters
    const {
      query: initialQuery,
      from: initialFrom,
      to: initialTo,
      limit,
      max_processing_time,
    } = GetAllServicesZodSchema.parse(request.params.arguments)

    // Use let for variables that will be modified
    let query = initialQuery
    let from = initialFrom
    let to = initialTo

    // Set timeout for the entire operation
    const startTime = Date.now()
    const timeoutMs = max_processing_time || 30000 // Default to 30 seconds if not specified

    // Check for relative time expressions and adjust timestamps if needed
    // First, try to parse relative time expressions from the query
    const adjustedTime = parseRelativeTimeInQuery(query, from, to)

    // Special case to handle empty query with possibly outdated timestamps
    if (!adjustedTime.wasAdjusted && (!query || query.trim() === '')) {
      // For empty queries, always verify timestamps are current
      const now = Math.floor(Date.now() / 1000)

      // If timestamps differ by more than a day or are from previous year, auto-correct
      if (to && Math.abs(now - to) > 86400) {
        const toDate = new Date(to * 1000)
        const currentYear = new Date().getFullYear()

        if (toDate.getFullYear() < currentYear) {
          // Auto-correct timestamps from previous year
          from = now - 3600 // Default to past hour
          to = now
          log(
            'info',
            `Auto-corrected timestamps from ${toDate.getFullYear()} to current year ${currentYear} (get_all_services with empty query)`,
          )
          adjustedTime.wasAdjusted = true
          adjustedTime.from = from
          adjustedTime.to = to
        }
      }
    }

    if (adjustedTime.wasAdjusted) {
      from = adjustedTime.from
      to = adjustedTime.to

      // Define regex for all time expressions we want to remove from the query
      const timeExpressions = [
        // past/last X minute(s)/hour(s)/day(s)/week(s)/month(s)
        { regex: /(past|last)\s+(\d+)\s+minute[s]?/i },
        { regex: /(past|last)\s+(\d+)\s+hour[s]?/i },
        { regex: /(past|last)\s+(\d+)\s+day[s]?/i },
        { regex: /(past|last)\s+(\d+)\s+week[s]?/i },
        { regex: /(past|last)\s+(\d+)\s+month[s]?/i },

        // X minute(s)/hour(s)/day(s)/week(s)/month(s) ago
        { regex: /(\d+)\s+minute[s]?\s+ago/i },
        { regex: /(\d+)\s+hour[s]?\s+ago/i },
        { regex: /(\d+)\s+day[s]?\s+ago/i },
        { regex: /(\d+)\s+week[s]?\s+ago/i },
        { regex: /(\d+)\s+month[s]?\s+ago/i },

        // past/last hour/day/week/month (implied 1)
        { regex: /(past|last)\s+hour/i },
        { regex: /(past|last)\s+day/i },
        { regex: /(past|last)\s+week/i },
        { regex: /(past|last)\s+month/i },

        // Special cases
        { regex: /an?\s+hour\s+ago/i },
        { regex: /a\s+day\s+ago/i },
        { regex: /a\s+week\s+ago/i },
        { regex: /a\s+month\s+ago/i },
        { regex: /today/i },
        { regex: /yesterday/i },
      ]

      // Remove time expressions from query
      timeExpressions.forEach((expr) => {
        query = query.replace(expr.regex, '').trim()
      })

      // Clean up leftover operators
      query = query
        .replace(/^\s*AND\s+/i, '')
        .replace(/\s+AND\s*$/i, '')
        .trim()

      log('info', `Adjusted services query: "${query}"`)
    }

    try {
      // Wrap the API call in a timeout
      const { result: response, timedOut } = await executeWithTimeout(
        async () => {
          const response = await apiInstance.listLogs({
            body: {
              filter: {
                query,
                // `from` and `to` are in epoch seconds, but the Datadog API expects milliseconds
                from: `${from * 1000}`,
                to: `${to * 1000}`,
              },
              page: {
                limit: Math.min(limit, 1000), // Cap at 1000 logs max
              },
              sort: '-timestamp',
            },
          })

          return response
        },
        timeoutMs,
        null, // Default empty result if timeout occurs
      )

      // Handle timeout
      if (timedOut) {
        return {
          content: [
            {
              type: 'text',
              text: `The request timed out after ${timeoutMs / 1000} seconds. Please try with a more specific query or a shorter time range.`,
            },
          ],
        }
      }

      // If no data was returned
      if (!response || !response.data || response.data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No logs were found matching your query criteria. No services could be extracted.',
            },
          ],
        }
      }

      // Extract unique services from logs
      const services = new Set<string>()

      for (const log of response.data) {
        // Access service attribute from logs based on the Datadog API structure
        if (log.attributes && log.attributes.service) {
          services.add(log.attributes.service)
        }
      }

      const serviceList = Array.from(services).sort()

      // Add processing info including time taken
      const processingTime = Date.now() - startTime
      const processingInfo = {
        processingTimeMs: processingTime,
        timedOut: false,
        logsProcessed: response.data.length,
      }

      // Create a summary including the time range
      const summary = {
        count: serviceList.length,
        timeRange: {
          from,
          to,
          from_formatted: new Date(from * 1000).toISOString(),
          to_formatted: new Date(to * 1000).toISOString(),
        },
        query,
      }

      return {
        content: [
          {
            type: 'text',
            text: `ProcessingInfo: ${JSON.stringify(processingInfo)}`,
          },
          {
            type: 'text',
            text: `Services: ${JSON.stringify(serviceList)}`,
          },
          {
            type: 'text',
            text: `Summary: ${JSON.stringify(summary)}`,
          },
        ],
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      throw new Error(
        `Failed to fetch services: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  },
})
