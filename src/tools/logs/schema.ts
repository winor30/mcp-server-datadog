import { z } from 'zod'

/**
 * Schema for retrieving logs from Datadog or getting a specific log by ID.
 *
 * This tool supports two main usage patterns:
 *
 * 1. Searching for logs with filters:
 *    datadog:get_logs (MCP)(from: 1746103797, to: 1746190197, query: "env:prod \"Error message\"", limit: 5)
 *
 * 2. Retrieving a specific log by ID (preserving original search context):
 *    datadog:get_logs (MCP)(
 *      id: "AwAAAZaRCa7nDqnp1gAAABhBWmFSQ2J6ZkFBRDR2UEhwSXpjVmpBQUQAAAAkMDE5NjkxMTMtOThkOS00OGM0LTg2OTUtYjE0ZTRmNThlODZiAAAk0w",
 *      from: 1746103797,
 *      to: 1746190197,
 *      query: "env:prod \"Indexing to ES failed\"",  // CRITICAL: Include the original query
 *      full: true
 *    )
 *
 * IMPORTANT: When retrieving a specific log by ID from a previous search, include ALL original
 * parameters (query, from, to) to maintain the search context. The exact original query is CRITICAL
 * for finding the log in the Datadog database. Do NOT include the ID in the query string - use
 * the separate 'id' parameter instead.
 *
 * EXAMPLE WITH EXACT QUERY REPRODUCTION:
 *
 * Original search:
 * datadog:get_logs (MCP)(from: 1746103797, to: 1746190197, query: "env:prod \"Indexing to ES failed\"", limit: 5)
 *
 * Correct log retrieval:
 * datadog:get_logs (MCP)(
 *   id: "AwAAAZaRCa7nDqnp1gAAABhBWmFSQ2J6ZkFBRDR2UEhwSXpjVmpBQUQAAAAkMDE5NjkxMTMtOThkOS00OGM0LTg2OTUtYjE0ZTRmNThlODZiAAAk0w",
 *   from: 1746103797,
 *   to: 1746190197,
 *   query: "env:prod \"Indexing to ES failed\"",  // Copy EXACTLY - including quotes!
 *   full: true
 * )
 *
 * INCORRECT (will fail):
 * datadog:get_logs (MCP)(
 *   id: "AwAAAZaRCa7nDqnp1gAAABhBWmFSQ2J6ZkFBRDR2UEhwSXpjVmpBQUQAAAAkMDE5NjkxMTMtOThkOS00OGM0LTg2OTUtYjE0ZTRmNThlODZiAAAk0w",
 *   from: 1746103797,
 *   to: 1746190197,
 *   query: "env:prod",  // WRONG - not the complete original query!
 *   full: true
 * )
 */
export const GetLogsZodSchema = z
  .object({
    // Allow either a query or a specific log ID to be provided
    query: z
      .string()
      .default('')
      .describe(
        'Datadog logs query string. When used with id, provides search context.',
      ),
    from: z
      .number()
      .optional()
      .describe('Start time in epoch seconds (required unless id is provided)'),
    to: z
      .number()
      .optional()
      .describe('End time in epoch seconds (required unless id is provided)'),
    id: z
      .string()
      .optional()
      .describe(
        'Specific log ID to retrieve full details for. Use as a separate parameter, NOT in the query string.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe('Maximum number of logs to return (max 50). Default is 20.'),
    cursor: z
      .string()
      .optional()
      .describe(
        'Cursor for pagination. Use the cursor from the previous response.',
      ),
    compact: z
      .boolean()
      .optional()
      .default(true)
      .describe('Return logs in a compact format to reduce response size.'),
    full: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Return full, non-truncated metadata for the logs. Use this for detailed log view.',
      ),
    max_processing_time: z
      .number()
      .int()
      .min(1000)
      .max(120000)
      .optional()
      .default(30000)
      .describe(
        'Maximum processing time in milliseconds before returning (defaults to 30 seconds)',
      ),
  })
  .refine(
    (data) => {
      // Either both 'from' and 'to' must be provided, or 'id' must be provided
      return (
        (data.from !== undefined && data.to !== undefined) ||
        data.id !== undefined
      )
    },
    {
      message:
        "Either provide both 'from' and 'to' timestamps, or provide a specific 'id'",
    },
  )

// GetLogByIdZodSchema has been integrated into GetLogsZodSchema

/**
 * Schema for retrieving all unique service names from logs.
 * Defines parameters for querying logs within a time window.
 *
 * @param query - Optional. Additional query filter for log search. Defaults to "*" (all logs)
 * @param from - Required. Start time in epoch seconds
 * @param to - Required. End time in epoch seconds
 * @param limit - Optional. Maximum number of logs to search through. Default is 1000.
 */
export const GetAllServicesZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for log search'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
  limit: z
    .number()
    .optional()
    .default(1000)
    .describe('Maximum number of logs to search through. Default is 1000.'),
  max_processing_time: z
    .number()
    .int()
    .min(1000)
    .max(120000)
    .optional()
    .default(30000)
    .describe(
      'Maximum processing time in milliseconds before returning (defaults to 30 seconds)',
    ),
})
