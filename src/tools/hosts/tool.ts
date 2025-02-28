import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { ListHostsZodSchema, GetActiveHostsCountZodSchema, MuteHostZodSchema, UnmuteHostZodSchema } from './schema'
import { datadogConfig } from '../../utils/datadog'

type HostsToolName = 'list_hosts' | 'get_active_hosts_count' | 'mute_host' | 'unmute_host'
type HostsTool = ExtendedTool<HostsToolName>

export const HOSTS_TOOLS: HostsTool[] = [
  createToolSchema(
    MuteHostZodSchema,
    'mute_host',
    'Mute a host in Datadog',
  ),
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

const API_INSTANCE = new v1.HostsApi(datadogConfig)

type HostsToolHandlers = ToolHandlers<HostsToolName>

export const HOSTS_HANDLERS: HostsToolHandlers = {
  mute_host: async (request) => {
    const { hostname, message, end, override } = MuteHostZodSchema.parse(request.params.arguments)

    await API_INSTANCE.muteHost({
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
          text: JSON.stringify({
            status: 'success',
            message: `Host ${hostname} has been muted successfully${message ? ` with message: ${message}` : ''}${end ? ` until ${new Date(end * 1000).toISOString()}` : ''}`
          }, null, 2),
        },
      ],
    }
  },

  unmute_host: async (request) => {
    const { hostname } = UnmuteHostZodSchema.parse(request.params.arguments)

    await API_INSTANCE.unmuteHost({
      hostName: hostname,
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: `Host ${hostname} has been unmuted successfully`
          }, null, 2),
        },
      ],
    }
  },

  get_active_hosts_count: async (request) => {
    const { from } = GetActiveHostsCountZodSchema.parse(request.params.arguments)
    
    const response = await API_INSTANCE.getHostTotals({
      from,
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total_active: response.totalActive || 0, // Total number of active hosts (UP and reporting) to Datadog
            total_up: response.totalUp || 0          // Number of hosts that are UP and reporting to Datadog
          }, null, 2),
        },
      ],
    }
  },

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

    const response = await API_INSTANCE.listHosts({
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
} as const
