import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { GetIncidentZodSchema, ListIncidentsZodSchema } from './schema'
import { datadogConfig } from '../../utils/datadog'

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

const API_INSTANCE = new v2.IncidentsApi(datadogConfig)

type IncidentToolHandlers = ToolHandlers<IncidentToolName>

export const INCIDENT_HANDLERS: IncidentToolHandlers = {
  list_incidents: async (request) => {
    const { pageSize, pageOffset } = ListIncidentsZodSchema.parse(
      request.params.arguments,
    )

    const res = await API_INSTANCE.listIncidents({
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
    const { incidentId } = GetIncidentZodSchema.parse(request.params.arguments)
    const res = await API_INSTANCE.getIncident({
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
} as const
