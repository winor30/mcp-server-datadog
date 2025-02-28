import { z } from 'zod'

export const MuteHostZodSchema = z.object({
  hostname: z.string().describe('The name of the host to mute'),
  message: z.string().optional().describe('Message to associate with the muting of this host'),
  end: z.number().int().optional().describe('POSIX timestamp for when the mute should end'),
  override: z.boolean().optional().default(false).describe('If true and the host is already muted, replaces existing end time')
})

export const UnmuteHostZodSchema = z.object({
  hostname: z.string().describe('The name of the host to unmute')
})

export const GetActiveHostsCountZodSchema = z.object({
  from: z.number().int().optional().default(7200).describe('Number of seconds from which you want to get total number of active hosts (defaults to 2h)'),
})

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
