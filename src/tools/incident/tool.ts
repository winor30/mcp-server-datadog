import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
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
  apiInstance: v2.IncidentsApi,
): IncidentToolHandlers => {
  return {
    list_incidents: async (request) => {
      const { pageSize, pageOffset } = ListIncidentsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listIncidents({
        pageSize,
        pageOffset,
      })

      if (response.data == null) {
        throw new Error('No incidents data returned')
      }

      return {
        content: [
          {
            type: 'text',
            text: `Listed incidents:\n${response.data
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

      const response = await apiInstance.getIncident({
        incidentId,
      })

      if (response.data == null) {
        throw new Error('No incident data returned')
      }

      return {
        content: [
          {
            type: 'text',
            text: `Incident: ${JSON.stringify(response.data)}`,
          },
        ],
      }
    },
  }
}
