import { z } from 'zod'

/**
 * Zod schemas for validating input parameters for Datadog host management operations.
 * These schemas define the expected shape and types of data for each host-related tool.
 */

/**
 * Schema for muting a host in Datadog.
 * Defines required and optional parameters for temporarily silencing a host's alerts.
 * 
 * @param hostname - Required. Identifies the host to be muted
 * @param message - Optional. Adds context about why the host is being muted
 * @param end - Optional. Unix timestamp defining when the mute should automatically expire
 * @param override - Optional. Controls whether to replace an existing mute's end time
 */
export const MuteHostZodSchema = z.object({
  hostname: z.string().describe('The name of the host to mute'),
  message: z.string().optional().describe('Message to associate with the muting of this host'),
  end: z.number().int().optional().describe('POSIX timestamp for when the mute should end'),
  override: z.boolean().optional().default(false).describe('If true and the host is already muted, replaces existing end time')
})

/**
 * Schema for unmuting a host in Datadog.
 * Defines parameters for re-enabling alerts for a previously muted host.
 * 
 * @param hostname - Required. Identifies the host to be unmuted
 */
export const UnmuteHostZodSchema = z.object({
  hostname: z.string().describe('The name of the host to unmute')
})

/**
 * Schema for retrieving active host counts from Datadog.
 * Defines parameters for querying the number of reporting hosts within a time window.
 * 
 * @param from - Optional. Time window in seconds to check for host activity
 *               Defaults to 7200 seconds (2 hours)
 */
export const GetActiveHostsCountZodSchema = z.object({
  from: z.number().int().optional().default(7200).describe('Number of seconds from which you want to get total number of active hosts (defaults to 2h)'),
})

/**
 * Schema for listing and filtering hosts in Datadog.
 * Defines comprehensive parameters for querying and filtering host information.
 * 
 * @param filter - Optional. Search string to filter hosts
 * @param sort_field - Optional. Field to sort results by
 * @param sort_dir - Optional. Sort direction ('asc' or 'desc')
 * @param start - Optional. Pagination offset
 * @param count - Optional. Number of hosts to return (max 1000)
 * @param from - Optional. Unix timestamp to start searching from
 * @param include_muted_hosts_data - Optional. Include muting information
 * @param include_hosts_metadata - Optional. Include detailed host metadata
 */
export const ListHostsZodSchema = z.object({
  filter: z.string().optional().describe('Filter string for search results'),
  sort_field: z.string().optional().describe('Field to sort hosts by'),
  sort_dir: z.string().optional().describe('Sort direction (asc/desc)'),
  start: z.number().int().optional().describe('Starting offset for pagination'),
  count: z.number().int().max(1000).optional().describe('Max number of hosts to return (max: 1000)'),
  from: z.number().int().optional().describe('Search hosts from this UNIX timestamp'),
  include_muted_hosts_data: z.boolean().optional().describe('Include muted hosts status and expiry'),
  include_hosts_metadata: z.boolean().optional().describe('Include host metadata (version, platform, etc)'),
})
