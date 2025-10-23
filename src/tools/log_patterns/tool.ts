import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  FindLogPatternsZodSchema,
  ExtractErrorSignaturesZodSchema,
  DetectAnomalousPatternsZodSchema,
} from './schema'
import { log, parseRelativeTimeInQuery } from '../../utils/helper'
import {
  clusterSimilarMessages,
  generatePatternTemplate,
  extractErrorSignature,
  extractStackTrace,
  executeWithTimeout,
} from './utils'

type LogPatternsToolName =
  | 'find_log_patterns'
  | 'extract_error_signatures'
  | 'detect_anomalous_patterns'
type LogPatternsTool = ExtendedTool<LogPatternsToolName>

export const LOG_PATTERNS_TOOLS: LogPatternsTool[] = [
  createToolSchema(
    FindLogPatternsZodSchema,
    'find_log_patterns',
    'Find and group common log patterns within a specific time range',
  ),
  createToolSchema(
    ExtractErrorSignaturesZodSchema,
    'extract_error_signatures',
    'Identify and categorize error signatures from logs',
  ),
  createToolSchema(
    DetectAnomalousPatternsZodSchema,
    'detect_anomalous_patterns',
    'Detect unusual or anomalous log patterns compared to a baseline period',
  ),
] as const

type LogPatternsToolHandlers = ToolHandlers<LogPatternsToolName>

export const createLogPatternsToolHandlers = (
  logsApiInstance: v2.LogsApi,
): LogPatternsToolHandlers => {
  return {
    /**
     * Find and group common log patterns within a specific time range.
     * This helps identify recurring patterns and reduce log noise.
     */
    find_log_patterns: async (request) => {
      try {
        // First parse the original parameters
        let { from, to, query } = FindLogPatternsZodSchema.parse(
          request.params.arguments,
        )

        const {
          service,
          limit,
          max_patterns,
          min_occurrences,
          similarity_threshold,
          include_variables,
          cursor,
          max_processing_time,
        } = FindLogPatternsZodSchema.parse(request.params.arguments)

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
                `Auto-corrected timestamps from ${toDate.getFullYear()} to current year ${currentYear} (find_log_patterns with empty query)`,
              )
              adjustedTime.wasAdjusted = true
              adjustedTime.from = from
              adjustedTime.to = to
            }
          }
        }

        if (adjustedTime.wasAdjusted) {
          from = adjustedTime.from!
          to = adjustedTime.to!

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

          log('info', `Adjusted log patterns query: "${query}"`)
          log(
            'info',
            `Adjusted timestamp range: from=${from} (${new Date(from * 1000).toISOString()}) to=${to} (${new Date(to * 1000).toISOString()})`,
          )
        }

        // Build the query
        let combinedQuery = query || ''
        if (service) {
          combinedQuery = combinedQuery
            ? `${combinedQuery} service:${service}`
            : `service:${service}`
        }

        // Start time tracking
        const startTime = Date.now()
        const timeoutMs = max_processing_time

        // Initialize storage for all logs and tracking variables
        let allLogs: Array<{ id: string; message: string; timestamp: number }> =
          []
        let nextCursor: string | null = cursor || null
        let hasMore = true
        let requestCount = 0
        let isComplete = false

        // Paginate through logs with timeout safeguard
        while (hasMore && Date.now() - startTime < timeoutMs) {
          requestCount++
          try {
            // Fetch a page of logs
            const response = await logsApiInstance.listLogs({
              body: {
                filter: {
                  query: combinedQuery,
                  from: `${from * 1000}`,
                  to: `${to * 1000}`,
                },
                page: {
                  limit,
                  cursor: nextCursor || undefined,
                },
                sort: '-timestamp',
              },
            })

            if (!response.data || response.data.length === 0) {
              hasMore = false
              isComplete = true
              break
            }

            // Process this page of logs
            const pageLogs = response.data
              .map((log) => ({
                id: log.id || `unknown-${Math.random()}`,
                message: log.attributes?.message || '',
                timestamp: log.attributes?.timestamp
                  ? Math.floor(log.attributes.timestamp / 1000)
                  : 0,
              }))
              .filter((log) => log.message.trim() !== '')

            // Add to our collection
            allLogs = [...allLogs, ...pageLogs]

            // Update pagination info
            nextCursor = response.meta?.page?.after || null
            hasMore = !!nextCursor

            // Break if we've collected enough logs for analysis
            if (allLogs.length >= limit * 10) {
              break
            }
          } catch (fetchError) {
            console.error('Error fetching logs page:', fetchError)
            // On error, work with what we have so far but mark as incomplete
            hasMore = false
            break
          }
        }

        // Check if we completed all pages or timed out
        isComplete = isComplete || !hasMore

        // Extract messages for pattern analysis
        const messages = allLogs.map((log) => log.message)

        // Execute pattern clustering with timeout
        const { result: patternGroups, timedOut } = await executeWithTimeout(
          async () => {
            // Cluster similar messages
            const clusters = clusterSimilarMessages(
              messages,
              similarity_threshold,
            )

            // Filter clusters by minimum size and limit total number
            return clusters
              .filter((cluster) => cluster.length >= min_occurrences)
              .slice(0, max_patterns)
          },
          timeoutMs - (Date.now() - startTime), // Remaining time
          [], // Default empty result if timeout occurs
        )

        // Generate pattern information
        const patterns = patternGroups.map((group, index) => {
          // Get pattern template
          const template = generatePatternTemplate(group)

          // Find the first and last occurrence timestamps
          const patternLogs = allLogs.filter((log) =>
            group.includes(log.message),
          )

          const timestamps = patternLogs.map((log) => log.timestamp).sort()
          const firstOccurrence = timestamps.length > 0 ? timestamps[0] : null
          const lastOccurrence =
            timestamps.length > 0 ? timestamps[timestamps.length - 1] : null

          // Get example instances
          const examples = group.slice(0, 3)

          return {
            pattern_id: `pattern-${index + 1}`,
            template,
            occurrences: group.length,
            first_occurrence: firstOccurrence,
            first_occurrence_formatted: firstOccurrence
              ? new Date(firstOccurrence * 1000).toISOString()
              : null,
            last_occurrence: lastOccurrence,
            last_occurrence_formatted: lastOccurrence
              ? new Date(lastOccurrence * 1000).toISOString()
              : null,
            examples: include_variables ? examples : undefined,
          }
        })

        // Create response data
        const processingTime = Date.now() - startTime
        const processingStatus = {
          complete: isComplete && !timedOut,
          timed_out: timedOut,
          logs_processed: allLogs.length,
          processing_time_ms: processingTime,
          request_count: requestCount,
        }

        // Generate pagination info for client continuation if needed
        const pagination = {
          has_more: hasMore,
          next_cursor: nextCursor,
          time_range: {
            from,
            to,
            from_formatted: new Date(from * 1000).toISOString(),
            to_formatted: new Date(to * 1000).toISOString(),
          },
        }

        return {
          content: [
            {
              type: 'text',
              text: `Status: ${JSON.stringify(processingStatus)}`,
            },
            {
              type: 'text',
              text: `Pagination: ${JSON.stringify(pagination)}`,
            },
            {
              type: 'text',
              text: `Patterns: ${JSON.stringify(patterns)}`,
            },
            !isComplete
              ? {
                  type: 'text',
                  text: `Warning: Processing was incomplete. To continue pattern analysis with current results, use cursor: "${nextCursor}" in your next request.`,
                }
              : null,
          ].filter(Boolean),
        }
      } catch (error) {
        console.error('Error finding log patterns:', error)
        throw new Error(
          `Failed to find log patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },

    /**
     * Extract and categorize error signatures from logs.
     * This helps identify common error types and patterns.
     */
    extract_error_signatures: async (request) => {
      try {
        // First parse the original parameters
        let { from, to, query } = ExtractErrorSignaturesZodSchema.parse(
          request.params.arguments,
        )

        const {
          limit,
          group_by_location,
          extract_stack_frames,
          max_error_groups,
          cursor,
          max_processing_time,
        } = ExtractErrorSignaturesZodSchema.parse(request.params.arguments)

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
                `Auto-corrected timestamps from ${toDate.getFullYear()} to current year ${currentYear} (extract_error_signatures with empty query)`,
              )
              adjustedTime.wasAdjusted = true
              adjustedTime.from = from
              adjustedTime.to = to
            }
          }
        }

        if (adjustedTime.wasAdjusted) {
          from = adjustedTime.from!
          to = adjustedTime.to!

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

          log('info', `Adjusted error signatures query: "${query}"`)
          log(
            'info',
            `Adjusted timestamp range: from=${from} (${new Date(from * 1000).toISOString()}) to=${to} (${new Date(to * 1000).toISOString()})`,
          )
        }

        // Start time tracking
        const startTime = Date.now()
        const timeoutMs = max_processing_time

        // Initialize storage for all error logs and tracking variables
        let allErrorLogs: Array<{
          id: string
          message: string
          timestamp: number
          attributes: Record<string, unknown>
        }> = []
        let nextCursor: string | null = cursor || null
        let hasMore = true
        let requestCount = 0
        let isComplete = false

        // Paginate through logs with timeout safeguard
        while (hasMore && Date.now() - startTime < timeoutMs) {
          requestCount++
          try {
            // Fetch a page of error logs
            const response = await logsApiInstance.listLogs({
              body: {
                filter: {
                  query,
                  from: `${from * 1000}`,
                  to: `${to * 1000}`,
                },
                page: {
                  limit,
                  cursor: nextCursor || undefined,
                },
                sort: '-timestamp',
              },
            })

            if (!response.data || response.data.length === 0) {
              hasMore = false
              isComplete = true
              break
            }

            // Process this page of logs
            const pageLogs = response.data
              .map((log) => ({
                id: log.id || `unknown-${Math.random()}`,
                message: log.attributes?.message || '',
                timestamp: log.attributes?.timestamp
                  ? Math.floor(log.attributes.timestamp / 1000)
                  : 0,
                attributes: log.attributes || {},
              }))
              .filter((log) => log.message.trim() !== '')

            // Add to our collection
            allErrorLogs = [...allErrorLogs, ...pageLogs]

            // Update pagination info
            nextCursor = response.meta?.page?.after || null
            hasMore = !!nextCursor

            // Break if we've collected enough logs for analysis
            if (allErrorLogs.length >= limit * 5) {
              break
            }
          } catch (fetchError) {
            console.error('Error fetching error logs page:', fetchError)
            // On error, work with what we have so far but mark as incomplete
            hasMore = false
            break
          }
        }

        // Check if we completed all pages or timed out
        isComplete = isComplete || !hasMore

        // Execute error signature extraction with timeout
        const { result: errorSignatures, timedOut } = await executeWithTimeout(
          async () => {
            // Process logs to extract error signatures
            const errorGroups: {
              [key: string]: {
                error_type: string
                count: number
                first_seen: number
                last_seen: number
                examples: Array<{ message: string; timestamp: number }>
                stack_frames: string[]
                services: Set<string>
                error_messages: Set<string>
                hosts: Set<string>
              }
            } = {}

            for (const log of allErrorLogs) {
              // Extract error information
              const { errorType, errorMessage } = extractErrorSignature(
                log.message,
              )
              const stackFrames =
                extract_stack_frames > 0
                  ? extractStackTrace(log.message, extract_stack_frames)
                  : []

              // Generate a grouping key
              let groupKey = errorType

              // Include stack trace location in the key if requested
              if (group_by_location && stackFrames.length > 0) {
                groupKey += `::${stackFrames[0]}`
              }

              // Initialize group if new
              if (!errorGroups[groupKey]) {
                errorGroups[groupKey] = {
                  error_type: errorType,
                  count: 0,
                  first_seen: log.timestamp,
                  last_seen: log.timestamp,
                  examples: [],
                  stack_frames: stackFrames,
                  services: new Set(),
                  error_messages: new Set(),
                  hosts: new Set(),
                }
              }

              // Update group stats
              const group = errorGroups[groupKey]
              group.count++
              group.first_seen = Math.min(group.first_seen, log.timestamp)
              group.last_seen = Math.max(group.last_seen, log.timestamp)

              // Add example if we have few
              if (group.examples.length < 3) {
                group.examples.push({
                  message: log.message.slice(0, 500), // Limit length
                  timestamp: log.timestamp,
                })
              }

              // Add metadata
              if (log.attributes?.service)
                group.services.add(log.attributes.service)
              if (log.attributes?.host) group.hosts.add(log.attributes.host)
              group.error_messages.add(errorMessage.slice(0, 200)) // Collect unique error messages
            }

            // Convert error groups to array and sort by count
            const sortedGroups = Object.values(errorGroups)
              .map((group) => ({
                ...group,
                services: Array.from(group.services),
                hosts: Array.from(group.hosts),
                error_messages: Array.from(group.error_messages),
                first_seen_formatted: new Date(
                  group.first_seen * 1000,
                ).toISOString(),
                last_seen_formatted: new Date(
                  group.last_seen * 1000,
                ).toISOString(),
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, max_error_groups)

            return sortedGroups
          },
          timeoutMs - (Date.now() - startTime), // Remaining time
          [], // Default empty result if timeout occurs
        )

        // Create response data
        const processingTime = Date.now() - startTime
        const processingStatus = {
          complete: isComplete && !timedOut,
          timed_out: timedOut,
          logs_processed: allErrorLogs.length,
          processing_time_ms: processingTime,
          request_count: requestCount,
          error_signatures_found: errorSignatures.length,
        }

        // Generate pagination info for client continuation if needed
        const pagination = {
          has_more: hasMore,
          next_cursor: nextCursor,
          time_range: {
            from,
            to,
            from_formatted: new Date(from * 1000).toISOString(),
            to_formatted: new Date(to * 1000).toISOString(),
          },
        }

        // Calculate summary information
        const summary = {
          total_errors: allErrorLogs.length,
          error_groups: errorSignatures.length,
          top_error_type:
            errorSignatures.length > 0 ? errorSignatures[0].error_type : null,
          top_error_count:
            errorSignatures.length > 0 ? errorSignatures[0].count : 0,
          services_affected: Array.from(
            new Set(errorSignatures.flatMap((sig) => sig.services)),
          ),
        }

        return {
          content: [
            {
              type: 'text',
              text: `Status: ${JSON.stringify(processingStatus)}`,
            },
            {
              type: 'text',
              text: `Summary: ${JSON.stringify(summary)}`,
            },
            {
              type: 'text',
              text: `Pagination: ${JSON.stringify(pagination)}`,
            },
            {
              type: 'text',
              text: `ErrorSignatures: ${JSON.stringify(errorSignatures)}`,
            },
            !isComplete
              ? {
                  type: 'text',
                  text: `Warning: Processing was incomplete. To continue error signature analysis with current results, use cursor: "${nextCursor}" in your next request.`,
                }
              : null,
          ].filter(Boolean),
        }
      } catch (error) {
        console.error('Error extracting error signatures:', error)
        throw new Error(
          `Failed to extract error signatures: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },

    /**
     * Detect anomalous log patterns by comparing with a baseline period.
     * This identifies unusual patterns that may indicate problems.
     */
    detect_anomalous_patterns: async (request) => {
      try {
        // First parse the original parameters
        let { from, to, query } = DetectAnomalousPatternsZodSchema.parse(
          request.params.arguments,
        )

        const {
          baseline_from,
          baseline_to,
          limit,
          sensitivity,
          monitor_id,
          max_anomalies,
          cursor,
          baseline_cursor,
          max_processing_time,
        } = DetectAnomalousPatternsZodSchema.parse(request.params.arguments)

        // Check for relative time expressions and adjust timestamps if needed
        // For anomalous patterns, we only apply to the analysis period (from/to)
        // and leave the baseline period as explicitly defined
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
                `Auto-corrected timestamps from ${toDate.getFullYear()} to current year ${currentYear} (detect_anomalous_patterns with empty query)`,
              )
              adjustedTime.wasAdjusted = true
              adjustedTime.from = from
              adjustedTime.to = to
            }
          }
        }

        if (adjustedTime.wasAdjusted) {
          from = adjustedTime.from!
          to = adjustedTime.to!

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

          log('info', `Adjusted anomalous patterns query: "${query}"`)
          log(
            'info',
            `Adjusted analysis period: from=${from} (${new Date(from * 1000).toISOString()}) to=${to} (${new Date(to * 1000).toISOString()})`,
          )
          log(
            'info',
            `Baseline period unchanged: from=${baseline_from} (${new Date(baseline_from * 1000).toISOString()}) to=${baseline_to} (${new Date(baseline_to * 1000).toISOString()})`,
          )
        }

        // Start time tracking
        const startTime = Date.now()
        const timeoutMs = max_processing_time

        // Build query with optional monitor correlation
        let combinedQuery = query || ''
        if (monitor_id) {
          // If a monitor ID is provided, correlate logs with that monitor
          combinedQuery = combinedQuery
            ? `${combinedQuery} monitor_id:${monitor_id}`
            : `monitor_id:${monitor_id}`
        }

        // Fetch logs from both periods (analysis and baseline)
        // We'll use Promise.all to fetch both in parallel
        const fetchPeriodLogs = async (
          periodFrom: number,
          periodTo: number,
          periodCursor: string | null,
        ): Promise<{
          logs: Array<{
            id: string
            message: string
            timestamp: number
            attributes: Record<string, unknown>
          }>
          nextCursor: string | null
          isComplete: boolean
        }> => {
          let allLogs: Array<{
            id: string
            message: string
            timestamp: number
            attributes: Record<string, unknown>
          }> = []
          let nextCursor: string | null = periodCursor || null
          let hasMore = true
          let isComplete = false
          let subRequestCount = 0

          // Paginate through logs with timeout safeguard
          const periodStartTime = Date.now()
          const periodTimeoutMs = Math.min(
            timeoutMs / 2, // Split time budget between the two periods
            30000, // Max 30 seconds per period
          )

          while (hasMore && Date.now() - periodStartTime < periodTimeoutMs) {
            // Increment counter for API requests
            const apiRequestCount = subRequestCount + 1
            // Track the total number of requests
            subRequestCount = apiRequestCount
            try {
              // Fetch a page of logs
              const response = await logsApiInstance.listLogs({
                body: {
                  filter: {
                    query: combinedQuery,
                    from: `${periodFrom * 1000}`,
                    to: `${periodTo * 1000}`,
                  },
                  page: {
                    limit,
                    cursor: nextCursor || undefined,
                  },
                  sort: '-timestamp',
                },
              })

              if (!response.data || response.data.length === 0) {
                hasMore = false
                isComplete = true
                break
              }

              // Process this page of logs
              const pageLogs = response.data
                .map((log) => ({
                  id: log.id || `unknown-${Math.random()}`,
                  message: log.attributes?.message || '',
                  timestamp: log.attributes?.timestamp
                    ? Math.floor(log.attributes.timestamp / 1000)
                    : 0,
                  attributes: log.attributes || {},
                }))
                .filter((log) => log.message.trim() !== '')

              // Add to our collection
              allLogs = [...allLogs, ...pageLogs]

              // Update pagination info
              nextCursor = response.meta?.page?.after || null
              hasMore = !!nextCursor

              // Break if we've collected enough logs for analysis
              if (allLogs.length >= limit * 3) {
                break
              }
            } catch (fetchError) {
              console.error('Error fetching logs page:', fetchError)
              // On error, work with what we have so far but mark as incomplete
              hasMore = false
              break
            }
          }

          // Check if we completed all pages or timed out
          isComplete = isComplete || !hasMore

          return { logs: allLogs, nextCursor, isComplete }
        }

        // Fetch logs from both periods in parallel
        const [analysisPeriod, baselinePeriod] = await Promise.all([
          fetchPeriodLogs(from, to, cursor),
          fetchPeriodLogs(baseline_from, baseline_to, baseline_cursor),
        ])

        // Execute anomaly detection with timeout
        const { result: anomalies, timedOut } = await executeWithTimeout(
          async () => {
            // Group logs by pattern in both periods
            const getPatternGroups = (
              logs: Array<{ message: string }>,
              similarityThreshold: number = 0.7,
            ) => {
              const messages = logs.map((log) => log.message)
              const clusters = clusterSimilarMessages(
                messages,
                similarityThreshold,
              )

              return clusters.map((cluster) => ({
                pattern: generatePatternTemplate(cluster),
                count: cluster.length,
                examples: cluster.slice(0, 2), // Keep just a couple examples
              }))
            }

            // Get pattern frequencies from both periods
            const analysisPatterns = getPatternGroups(analysisPeriod.logs)
            const baselinePatterns = getPatternGroups(baselinePeriod.logs)

            // Create a map of baseline patterns for easy lookup
            const baselinePatternMap = new Map<string, number>()
            baselinePatterns.forEach((pattern) => {
              baselinePatternMap.set(pattern.pattern, pattern.count)
            })

            // Compare analysis patterns to baseline
            const patternAnomalies = analysisPatterns.map((pattern) => {
              // Get baseline count for this pattern (0 if not present)
              const baselineCount = baselinePatternMap.get(pattern.pattern) || 0

              // Convert counts to rates (per hour)
              const analysisPeriodHours = (to - from) / 3600
              const baselinePeriodHours = (baseline_to - baseline_from) / 3600

              const analysisRate = pattern.count / analysisPeriodHours
              const baselineRate = baselineCount / baselinePeriodHours

              // Calculate change factors
              let changeRatio = 0
              let percentageChange = 0

              if (baselineRate === 0) {
                // If pattern wasn't in baseline, it's completely new
                changeRatio = pattern.count > 5 ? 999 : 0 // Only flag if it appears several times
                percentageChange = 100
              } else {
                changeRatio = analysisRate / baselineRate
                percentageChange =
                  ((analysisRate - baselineRate) / baselineRate) * 100
              }

              // Assign anomaly score based on ratio and absolute count
              // Higher score = more anomalous
              const anomalyScore = calculateAnomalyScore(
                changeRatio,
                percentageChange,
                pattern.count,
                baselineCount === 0,
              )

              return {
                pattern: pattern.pattern,
                analysis_count: pattern.count,
                baseline_count: baselineCount,
                analysis_rate: analysisRate.toFixed(2),
                baseline_rate: baselineRate.toFixed(2),
                change_ratio: changeRatio.toFixed(2),
                percentage_change: percentageChange.toFixed(2),
                is_new_pattern: baselineCount === 0,
                anomaly_score: anomalyScore,
                examples: pattern.examples,
              }
            })

            // Apply sensitivity filtering and sort by anomaly score
            return patternAnomalies
              .filter((anomaly) => {
                // Convert sensitivity (1-10) to minimum anomaly score threshold
                const minScore = 5 + (10 - sensitivity) * 3
                return anomaly.anomaly_score >= minScore
              })
              .sort((a, b) => b.anomaly_score - a.anomaly_score)
              .slice(0, max_anomalies)
          },
          timeoutMs - (Date.now() - startTime), // Remaining time
          [], // Default empty result if timeout occurs
        )

        // Create pagination info for client continuation if needed
        const pagination = {
          analysis_period: {
            has_more: analysisPeriod.nextCursor !== null,
            next_cursor: analysisPeriod.nextCursor,
            logs_processed: analysisPeriod.logs.length,
            is_complete: analysisPeriod.isComplete,
            time_range: {
              from,
              to,
              from_formatted: new Date(from * 1000).toISOString(),
              to_formatted: new Date(to * 1000).toISOString(),
            },
          },
          baseline_period: {
            has_more: baselinePeriod.nextCursor !== null,
            next_cursor: baselinePeriod.nextCursor,
            logs_processed: baselinePeriod.logs.length,
            is_complete: baselinePeriod.isComplete,
            time_range: {
              from: baseline_from,
              to: baseline_to,
              from_formatted: new Date(baseline_from * 1000).toISOString(),
              to_formatted: new Date(baseline_to * 1000).toISOString(),
            },
          },
        }

        // Create response data
        const processingTime = Date.now() - startTime
        const processingStatus = {
          complete:
            analysisPeriod.isComplete && baselinePeriod.isComplete && !timedOut,
          timed_out: timedOut,
          processing_time_ms: processingTime,
          anomalies_found: anomalies.length,
        }

        // Calculate summary information
        const summary = {
          high_severity_anomalies: anomalies.filter(
            (a) => a.anomaly_score >= 20,
          ).length,
          new_patterns: anomalies.filter((a) => a.is_new_pattern).length,
          top_anomaly_change:
            anomalies.length > 0
              ? `${anomalies[0].percentage_change}% ${anomalies[0].is_new_pattern ? '(new pattern)' : ''}`
              : null,
          monitor_id: monitor_id || null,
        }

        return {
          content: [
            {
              type: 'text',
              text: `Status: ${JSON.stringify(processingStatus)}`,
            },
            {
              type: 'text',
              text: `Summary: ${JSON.stringify(summary)}`,
            },
            {
              type: 'text',
              text: `Pagination: ${JSON.stringify(pagination)}`,
            },
            {
              type: 'text',
              text: `Anomalies: ${JSON.stringify(anomalies)}`,
            },
            {
              type: 'text',
              text: `DEBUG - Analysis Logs: ${JSON.stringify(analysisPeriod.logs.map((l) => l.message))}`,
            },
            {
              type: 'text',
              text: `DEBUG - Baseline Logs: ${JSON.stringify(baselinePeriod.logs.map((l) => l.message))}`,
            },
            !processingStatus.complete
              ? {
                  type: 'text',
                  text: `Warning: Processing was incomplete. To continue anomaly detection with current results, use cursor: "${analysisPeriod.nextCursor}" and baseline_cursor: "${baselinePeriod.nextCursor}" in your next request.`,
                }
              : null,
          ].filter(Boolean),
        }
      } catch (error) {
        console.error('Error detecting anomalous patterns:', error)
        throw new Error(
          `Failed to detect anomalous patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },
  }
}

/**
 * Calculate an anomaly score based on various factors
 * Higher score means more anomalous
 */
function calculateAnomalyScore(
  changeRatio: number,
  percentageChange: number,
  count: number,
  isNew: boolean,
): number {
  // Base score from change ratio
  let score = 0

  // Factor in the magnitude of change
  if (changeRatio >= 10) {
    score += 15 // Extreme increase (10x+)
  } else if (changeRatio >= 3) {
    score += 10 // Large increase (3x-10x)
  } else if (changeRatio >= 2) {
    score += 5 // Moderate increase (2x-3x)
  } else if (changeRatio >= 1.5) {
    score += 3 // Small increase (1.5x-2x)
  }

  // Factor in absolute count (more occurrences = more significant)
  if (count >= 100) {
    score += 10 // Very frequent
  } else if (count >= 30) {
    score += 5 // Frequent
  } else if (count >= 10) {
    score += 3 // Moderately frequent
  } else if (count < 3) {
    score -= 5 // Very rare (might be noise)
  }

  // Factor in whether this is a completely new pattern
  if (isNew && count >= 5) {
    score += 7 // New patterns with multiple occurrences are notable
  }

  // Factor in percentage change for additional granularity
  if (percentageChange >= 1000) {
    score += 3 // Extreme percentage increase
  } else if (percentageChange >= 500) {
    score += 2 // Very large percentage increase
  } else if (percentageChange >= 200) {
    score += 1 // Large percentage increase
  }

  return score
}
