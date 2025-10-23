import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  ListEventsZodSchema,
  GetEventZodSchema,
  CreateEventZodSchema,
} from './schema'

type EventsToolName = 'list_events' | 'get_event' | 'create_event'
type EventsTool = ExtendedTool<EventsToolName>

export const EVENTS_TOOLS: EventsTool[] = [
  createToolSchema(
    ListEventsZodSchema,
    'list_events',
    'Search and retrieve events from the Datadog event stream with filtering and pagination',
  ),
  createToolSchema(
    GetEventZodSchema,
    'get_event',
    'Get detailed information about a specific event by ID',
  ),
  createToolSchema(
    CreateEventZodSchema,
    'create_event',
    'Post a new event to the Datadog event stream',
  ),
] as const

type EventsToolHandlers = ToolHandlers<EventsToolName>

export const createEventsToolHandlers = (
  apiInstance: v1.EventsApi,
): EventsToolHandlers => {
  return {
    /**
     * List events from the Datadog event stream with filtering and pagination.
     * This endpoint is critical for browsing relevant events during incident investigation.
     */
    list_events: async (request) => {
      try {
        const {
          start,
          end,
          priority,
          sources,
          tags,
          unaggregated,
          excludeAggregate,
          page,
          limit,
        } = ListEventsZodSchema.parse(request.params.arguments)

        // Convert to Datadog API parameters
        const params: v1.EventsListEventsRequest = {
          start,
          end,
          priority,
          sources: sources?.join(','),
          tags: tags?.join(','),
          unaggregated,
          excludeAggregate,
          page,
          per_page: limit,
        }

        const response = await apiInstance.listEvents(params)

        if (!response || !response.events) {
          throw new Error('No events data returned')
        }

        // Process events to extract relevant information
        const events = response.events.map((event) => ({
          id: event.id,
          title: event.title,
          text: event.text,
          dateHappened: event.dateHappened,
          priority: event.priority,
          host: event.host,
          tags: event.tags,
          alertType: event.alertType,
          url: event.url,
          source: event.source,
          deviceName: event.deviceName,
          // Get ISO string for easier human readability
          dateHappenedFormatted: event.dateHappened
            ? new Date(event.dateHappened * 1000).toISOString()
            : undefined,
        }))

        // Create event categories for better analysis
        const eventCategories = events.reduce(
          (acc, event) => {
            // Extract category from source or tags
            let category = event.source || 'unknown'

            // Check if it's a monitor alert
            if (event.tags?.some((tag) => tag.startsWith('monitor:'))) {
              category = 'monitor_alert'
            }

            // Check if it's a deployment
            if (
              event.tags?.some(
                (tag) =>
                  tag.includes('deploy') ||
                  tag.includes('release') ||
                  tag.includes('version'),
              )
            ) {
              category = 'deployment'
            }

            if (!acc[category]) {
              acc[category] = {
                count: 0,
                events: [],
              }
            }

            acc[category].count++
            acc[category].events.push(event.id)

            return acc
          },
          {} as Record<string, { count: number; events: number[] }>,
        )

        // Calculate pagination info
        const pagination = {
          page,
          limit,
          total: events.length,
          timeRange: {
            start,
            end,
            startFormatted: new Date(start * 1000).toISOString(),
            endFormatted: new Date(end * 1000).toISOString(),
          },
          // Add hint for retrieving specific event details
          getEventDetailsHint:
            events.length > 0
              ? `To get detailed information for a specific event, use: id: ${events[0].id}`
              : null,
        }

        return {
          content: [
            {
              type: 'text',
              text: `Pagination: ${JSON.stringify(pagination)}`,
            },
            {
              type: 'text',
              text: `Categories: ${JSON.stringify(eventCategories)}`,
            },
            {
              type: 'text',
              text: `Events: ${JSON.stringify(events)}`,
            },
          ],
        }
      } catch (error) {
        console.error('Error listing events:', error)
        throw new Error(
          `Failed to list events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },

    /**
     * Get detailed information about a specific event by ID.
     */
    get_event: async (request) => {
      try {
        const { eventId } = GetEventZodSchema.parse(request.params.arguments)

        const response = await apiInstance.getEvent({
          eventId,
        })

        if (!response) {
          throw new Error(`Event with ID ${eventId} not found`)
        }

        // Format the response for better readability
        // Handle different potential response formats
        const event =
          response.event ||
          (response.additionalProperties
            ? response.additionalProperties
            : response)
        const formattedEvent = {
          ...event,
          dateHappenedFormatted: event.dateHappened
            ? new Date(event.dateHappened * 1000).toISOString()
            : undefined,
        }

        // Create a Datadog UI URL for the event if possible
        let datadogUrl = null
        if (event.id) {
          const start =
            (event.dateHappened || Math.floor(Date.now() / 1000) - 3600) - 3600 // 1 hour before event
          const end =
            (event.dateHappened || Math.floor(Date.now() / 1000)) + 3600 // 1 hour after event
          datadogUrl = `https://app.datadoghq.com/event/stream?event_id=${event.id}&start=${start * 1000}&end=${end * 1000}`
        }

        // Try to extract related entity information
        const relatedInfo = {
          monitorId: null as number | null,
          hostId: null as string | null,
        }

        // Extract monitor ID from tags if present
        if (event.tags) {
          for (const tag of event.tags) {
            if (tag.startsWith('monitor:')) {
              const monitorMatch = tag.match(/monitor:(\d+)/)
              if (monitorMatch && monitorMatch[1]) {
                relatedInfo.monitorId = parseInt(monitorMatch[1], 10)
              }
            }
            if (tag.startsWith('host:')) {
              const hostMatch = tag.match(/host:(.+)/)
              if (hostMatch && hostMatch[1]) {
                relatedInfo.hostId = hostMatch[1]
              }
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Event: ${JSON.stringify(formattedEvent)}`,
            },
            {
              type: 'text',
              text: datadogUrl
                ? `Datadog URL: ${datadogUrl}`
                : `Datadog URL: Not available`,
            },
            {
              type: 'text',
              text: `Related Information: ${JSON.stringify(relatedInfo)}`,
            },
          ],
        }
      } catch (error) {
        console.error('Error getting event:', error)
        throw new Error(
          `Failed to get event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },

    /**
     * Create a new event in the Datadog event stream.
     * Useful for tracking important operational changes or for testing.
     */
    create_event: async (request) => {
      try {
        const eventData = CreateEventZodSchema.parse(request.params.arguments)

        // Convert to Datadog API format
        const params: v1.EventCreateRequest = {
          body: {
            title: eventData.title,
            text: eventData.text,
            dateHappened: eventData.dateHappened,
            priority: eventData.priority,
            host: eventData.host,
            tags: eventData.tags,
            alertType: eventData.alertType,
            aggregationKey: eventData.aggregationKey,
            sourceTypeName: eventData.sourceTypeName,
            relatedEventId: eventData.relatedEventId,
            deviceName: eventData.deviceName,
          },
        }

        const response = await apiInstance.createEvent(params)

        if (!response || !response.event) {
          throw new Error('Failed to create event')
        }

        // Return the created event
        const createdEvent = response.event
        const formattedEvent = {
          ...createdEvent,
          dateHappenedFormatted: createdEvent.dateHappened
            ? new Date(createdEvent.dateHappened * 1000).toISOString()
            : undefined,
        }

        // Create a Datadog UI URL for the event if possible
        let datadogUrl = null
        if (createdEvent.id) {
          const start =
            (createdEvent.dateHappened ||
              Math.floor(Date.now() / 1000) - 3600) - 3600 // 1 hour before event
          const end =
            (createdEvent.dateHappened || Math.floor(Date.now() / 1000)) + 3600 // 1 hour after event
          datadogUrl = `https://app.datadoghq.com/event/stream?event_id=${createdEvent.id}&start=${start * 1000}&end=${end * 1000}`
        }

        return {
          content: [
            {
              type: 'text',
              text: `Event Created: ${JSON.stringify(formattedEvent)}`,
            },
            datadogUrl
              ? {
                  type: 'text',
                  text: `View Event: ${datadogUrl}`,
                }
              : null,
          ].filter(Boolean),
        }
      } catch (error) {
        console.error('Error creating event:', error)
        throw new Error(
          `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    },
  }
}
