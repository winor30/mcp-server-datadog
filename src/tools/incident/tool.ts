import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetIncidentZodSchema, ListIncidentsZodSchema } from './schema'

type IncidentToolName = 'list_incidents' | 'get_incident'
type IncidentTool = ExtendedTool<IncidentToolName>

export const INCIDENT_TOOLS: IncidentTool[] = [
  createToolSchema(
    ListIncidentsZodSchema,
    'list_incidents',
    'Get incidents from Datadog',
  ),
  createToolSchema(
    GetIncidentZodSchema,
    'get_incident',
    'Get an incident from Datadog',
  ),
] as const

type IncidentToolHandlers = ToolHandlers<IncidentToolName>

export const createIncidentToolHandlers = (
  config: client.Configuration,
): IncidentToolHandlers => {
  const apiInstance = new v2.IncidentsApi(config)
  return {
    list_incidents: async (request) => {
      const { pageSize, pageOffset } = ListIncidentsZodSchema.parse(
        request.params.arguments,
      )

      const res = await apiInstance.listIncidents({
        pageSize: pageSize,
        pageOffset: pageOffset,
      })
      return {
        content: [
          {
            type: 'text',
            text: `Listed incidents:\n${res.data
              .map((d) => JSON.stringify(d))
              .join('\n')}`,
          },
        ],
      }
    },
    get_incident: async (request) => {
      const { incidentId } = GetIncidentZodSchema.parse(
        request.params.arguments,
      )
      const res = await apiInstance.getIncident({
        incidentId: incidentId,
      })
      return {
        content: [
          {
            type: 'text',
            text: `Incident: ${JSON.stringify(res)}`,
          },
        ],
      }
    },
  }
}
