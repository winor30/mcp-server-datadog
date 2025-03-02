import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  ListHostsZodSchema,
  GetActiveHostsCountZodSchema,
  MuteHostZodSchema,
  UnmuteHostZodSchema,
} from './schema'

/**
 * This module implements Datadog host management tools for muting, unmuting,
 * and retrieving host information using the Datadog API client.
 */

/** Available host management tool names */
type HostsToolName =
  | 'list_hosts'
  | 'get_active_hosts_count'
  | 'mute_host'
  | 'unmute_host'
/** Extended tool type with host-specific operations */
type HostsTool = ExtendedTool<HostsToolName>

/**
 * Array of available host management tools.
 * Each tool is created with a schema for input validation and includes a description.
 */
export const HOSTS_TOOLS: HostsTool[] = [
  createToolSchema(MuteHostZodSchema, 'mute_host', 'Mute a host in Datadog'),
  createToolSchema(
    UnmuteHostZodSchema,
    'unmute_host',
    'Unmute a host in Datadog',
  ),
  createToolSchema(
    ListHostsZodSchema,
    'list_hosts',
    'Get list of hosts from Datadog',
  ),
  createToolSchema(
    GetActiveHostsCountZodSchema,
    'get_active_hosts_count',
    'Get the total number of active hosts in Datadog (defaults to last 5 minutes)',
  ),
] as const

/** Type definition for host management tool implementations */
type HostsToolHandlers = ToolHandlers<HostsToolName>

/**
 * Implementation of host management tool handlers.
 * Each handler validates inputs using Zod schemas and interacts with the Datadog API.
 */
export const createHostsToolHandlers = (
  config: client.Configuration,
): HostsToolHandlers => {
  const apiInstance = new v1.HostsApi(config)
  return {
    /**
     * Mutes a specified host in Datadog.
     * Silences alerts and notifications for the host until unmuted or until the specified end time.
     */
    mute_host: async (request) => {
      const { hostname, message, end, override } = MuteHostZodSchema.parse(
        request.params.arguments,
      )

      await apiInstance.muteHost({
        hostName: hostname,
        body: {
          message,
          end,
          override,
        },
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                message: `Host ${hostname} has been muted successfully${message ? ` with message: ${message}` : ''}${end ? ` until ${new Date(end * 1000).toISOString()}` : ''}`,
              },
              null,
              2,
            ),
          },
        ],
      }
    },

    /**
     * Unmutes a previously muted host in Datadog.
     * Re-enables alerts and notifications for the specified host.
     */
    unmute_host: async (request) => {
      const { hostname } = UnmuteHostZodSchema.parse(request.params.arguments)

      await apiInstance.unmuteHost({
        hostName: hostname,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                message: `Host ${hostname} has been unmuted successfully`,
              },
              null,
              2,
            ),
          },
        ],
      }
    },

    /**
     * Retrieves counts of active and up hosts in Datadog.
     * Provides total counts of hosts that are reporting and operational.
     */
    get_active_hosts_count: async (request) => {
      const { from } = GetActiveHostsCountZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getHostTotals({
        from,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total_active: response.totalActive || 0, // Total number of active hosts (UP and reporting) to Datadog
                total_up: response.totalUp || 0, // Number of hosts that are UP and reporting to Datadog
              },
              null,
              2,
            ),
          },
        ],
      }
    },

    /**
     * Lists and filters hosts monitored by Datadog.
     * Supports comprehensive querying with filtering, sorting, and pagination.
     * Returns detailed host information including status, metadata, and monitoring data.
     */
    list_hosts: async (request) => {
      const {
        filter,
        sort_field,
        sort_dir,
        start,
        count,
        from,
        include_muted_hosts_data,
        include_hosts_metadata,
      } = ListHostsZodSchema.parse(request.params.arguments)

      const response = await apiInstance.listHosts({
        filter,
        sortField: sort_field,
        sortDir: sort_dir,
        start,
        count,
        from,
        includeMutedHostsData: include_muted_hosts_data,
        includeHostsMetadata: include_hosts_metadata,
      })

      if (!response.hostList) {
        throw new Error('No hosts data returned')
      }

      // Transform API response into a more convenient format
      const hosts = response.hostList.map((host) => ({
        name: host.name,
        id: host.id,
        aliases: host.aliases,
        apps: host.apps,
        mute: host.isMuted,
        last_reported: host.lastReportedTime,
        meta: host.meta,
        metrics: host.metrics,
        sources: host.sources,
        up: host.up,
        url: `https://app.datadoghq.com/infrastructure?host=${host.name}`,
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Hosts: ${JSON.stringify(hosts)}`,
          },
        ],
      }
    },
  }
}
