import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetMonitorsZodSchema, GetMonitorEventZodSchema } from './schema'
import { unreachable } from '../../utils/helper'
import { UnparsedObject } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-common/util.js'

type MonitorsToolName = 'get_monitors' | 'get_monitor_event'
type MonitorsTool = ExtendedTool<MonitorsToolName>

export const MONITORS_TOOLS: MonitorsTool[] = [
  createToolSchema(
    GetMonitorsZodSchema,
    'get_monitors',
    'Get monitors status from Datadog',
  ),
  createToolSchema(
    GetMonitorEventZodSchema,
    'get_monitor_event',
    'Get specific monitor event by ID from Datadog',
  ),
] as const

type MonitorsToolHandlers = ToolHandlers<MonitorsToolName>

export const createMonitorsToolHandlers = (
  apiInstance: v1.MonitorsApi,
  eventsApiInstance?: v1.EventsApi,
): MonitorsToolHandlers => {
  return {
    get_monitors: async (request) => {
      try {
        const { groupStates, name, tags, limit, page, compact, id } =
          GetMonitorsZodSchema.parse(request.params.arguments)

        // If a specific monitor ID is provided, get that monitor directly
        if (id) {
          try {
            const monitor = await apiInstance.getMonitor({
              monitorId: id,
              groupStates: groupStates?.join(','),
            })

            if (!monitor) {
              throw new Error(`Monitor with ID ${id} not found`)
            }

            // Return full monitor details
            return {
              content: [
                {
                  type: 'text',
                  text: `Monitor: ${JSON.stringify(monitor)}`,
                },
              ],
            }
          } catch (getMonitorError) {
            console.error('Error fetching specific monitor:', getMonitorError)
            throw new Error(
              `Failed to fetch monitor with ID ${id}: ${getMonitorError instanceof Error ? getMonitorError.message : 'Unknown error'}`,
            )
          }
        }

        // Otherwise list monitors with filters
        let response
        try {
          response = await apiInstance.listMonitors({
            groupStates: groupStates?.join(','),
            name,
            tags: tags?.join(','),
          })

          if (response == null) {
            throw new Error('No monitors data returned')
          }
        } catch (listMonitorsError) {
          console.error('Error listing monitors:', listMonitorsError)
          throw new Error(
            `Failed to list monitors: ${listMonitorsError instanceof Error ? listMonitorsError.message : 'Unknown error'}`,
          )
        }

        try {
          // Calculate summary for all monitors
          const summary = response.reduce(
            (acc, monitor) => {
              const status = monitor.overallState
              if (status == null || status instanceof UnparsedObject) {
                return acc
              }

              switch (status) {
                case 'Alert':
                  acc.alert++
                  break
                case 'Warn':
                  acc.warn++
                  break
                case 'No Data':
                  acc.noData++
                  break
                case 'OK':
                  acc.ok++
                  break
                case 'Ignored':
                  acc.ignored++
                  break
                case 'Skipped':
                  acc.skipped++
                  break
                case 'Unknown':
                  acc.unknown++
                  break
                default:
                  unreachable(status)
              }
              return acc
            },
            {
              alert: 0,
              warn: 0,
              noData: 0,
              ok: 0,
              ignored: 0,
              skipped: 0,
              unknown: 0,
            },
          )

          // Apply pagination
          const startIndex = (page - 1) * limit
          const endIndex = startIndex + limit
          const paginatedResponse = response.slice(startIndex, endIndex)

          // Format monitors based on compact setting
          const monitors = compact
            ? paginatedResponse.map((monitor) => ({
                name: monitor.name || '',
                id: monitor.id || 0,
                status: (monitor.overallState as string) || 'unknown',
                message: monitor.message
                  ? monitor.message.substring(0, 100)
                  : '', // Limit message length
                tags: monitor.tags ? monitor.tags.slice(0, 5) : [], // Limit number of tags
                lastUpdatedTs: monitor.modified
                  ? Math.floor(new Date(monitor.modified).getTime() / 1000)
                  : undefined,
              }))
            : paginatedResponse.map((monitor) => {
                try {
                  // Convert native objects to plain objects to avoid circular references
                  const plainMonitor = {
                    id: monitor.id,
                    name: monitor.name,
                    type: monitor.type,
                    query: monitor.query,
                    message: monitor.message,
                    tags: monitor.tags,
                    options: monitor.options,
                    overallState: monitor.overallState,
                    creator: monitor.creator
                      ? {
                          id: monitor.creator.id,
                          name: monitor.creator.name,
                          handle: monitor.creator.handle,
                          email: monitor.creator.email,
                        }
                      : undefined,
                    created: monitor.created,
                    modified: monitor.modified,
                    deleted: monitor.deleted,
                    multi: monitor.multi,
                    priority: monitor.priority,
                    restricted_roles: monitor.restricted_roles,
                    monitoringThresholds: monitor.monitorThresholds,
                    searchable: monitor.overall_state_modified,
                  }

                  // Include stateGroups if available and it's an array
                  if (
                    monitor.state?.groups &&
                    Array.isArray(monitor.state.groups)
                  ) {
                    plainMonitor['stateGroups'] = monitor.state.groups.map(
                      (group) => ({
                        name: group.name,
                        status: group.status,
                        lastTriggeredTs: group.lastTriggeredTs,
                        lastNoDataTs: group.lastNoDataTs,
                        lastResolvedTs: group.lastResolvedTs,
                        lastNotifiedTs: group.lastNotifiedTs,
                        group: group.group,
                      }),
                    )
                  } else if (monitor.state?.groups) {
                    // If groups exists but isn't an array, add it as is
                    plainMonitor['stateGroups'] = monitor.state.groups
                  }

                  return plainMonitor
                } catch (monitorProcessingError) {
                  console.error(
                    'Error processing monitor:',
                    monitorProcessingError,
                    monitor,
                  )
                  // Return a simplified version instead of failing completely
                  return {
                    id: monitor.id || 0,
                    name: monitor.name || 'Unknown monitor',
                    error: 'Error processing monitor details',
                    status: (monitor.overallState as string) || 'unknown',
                  }
                }
              })

          // Pagination metadata
          const pagination = {
            totalCount: response.length,
            page,
            limit,
            totalPages: Math.ceil(response.length / limit),
            hasMore: endIndex < response.length,
          }

          return {
            content: [
              {
                type: 'text',
                text: `Monitors: ${JSON.stringify(monitors)}`,
              },
              {
                type: 'text',
                text: `Summary of monitors: ${JSON.stringify(summary)}`,
              },
              {
                type: 'text',
                text: `Pagination: ${JSON.stringify(pagination)}`,
              },
            ],
          }
        } catch (processingError) {
          console.error('Error processing monitors data:', processingError)
          throw new Error(
            `Failed to process monitors data: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`,
          )
        }
      } catch (error) {
        console.error('Error in get_monitors:', error)
        throw new Error(
          `Failed to fetch monitors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },

    get_monitor_event: async (request) => {
      if (!eventsApiInstance) {
        throw new Error('Events API not initialized')
      }

      const { monitorId, eventId, from, to } = GetMonitorEventZodSchema.parse(
        request.params.arguments,
      )

      try {
        // First, get the monitor details
        const monitor = await apiInstance.getMonitor({
          monitorId,
        })

        if (!monitor) {
          throw new Error(`Monitor not found with ID: ${monitorId}`)
        }

        // Try to extract a numeric event ID if possible
        let numericEventId: number | null = null
        try {
          // Look for number at the end of the string
          const match = eventId.match(/(\d+)$/)
          if (match && match[1]) {
            numericEventId = parseInt(match[1], 10)
          }
        } catch (e) {
          console.error('Failed to parse numeric event ID:', e)
        }

        // Construct the event URL for the user
        const now = Math.floor(Date.now() / 1000)
        const timeWindow = 24 * 60 * 60 // 24 hours
        const fromTs = from || now - timeWindow
        const toTs = to || now

        const ddUrl = `https://app.datadoghq.com/monitors/${monitorId}?event_id=${eventId}&from_ts=${fromTs * 1000}&to_ts=${toTs * 1000}&live=true`

        // Try to get event details if we were able to extract a numeric ID
        let eventDetails = null
        if (numericEventId) {
          try {
            eventDetails = await eventsApiInstance.getEvent({
              eventId: numericEventId,
            })
          } catch (e) {
            console.error('Failed to fetch event details:', e)
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Monitor: ${JSON.stringify({
                id: monitor.id,
                name: monitor.name,
                message: monitor.message,
                status: monitor.overallState,
                tags: monitor.tags,
              })}`,
            },
            {
              type: 'text',
              text: `Event ID: ${eventId}${numericEventId ? ` (Numeric ID: ${numericEventId})` : ''}`,
            },
            eventDetails
              ? {
                  type: 'text',
                  text: `Event Details: ${JSON.stringify(eventDetails)}`,
                }
              : {
                  type: 'text',
                  text: 'Event details not available',
                },
            {
              type: 'text',
              text: `Datadog URL: ${ddUrl}`,
            },
          ],
        }
      } catch (error) {
        console.error('Error fetching monitor event:', error)
        throw new Error(
          `Failed to fetch monitor event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },
  }
}
