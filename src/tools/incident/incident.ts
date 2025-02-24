import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { client, v2 } from '@datadog/datadog-api-client'
import { config, createToolSchema } from '../../utils/helper'
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

const CONFIG = client.createConfiguration({
  authMethods: {
    apiKeyAuth: config.apiKeyAuth,
    appKeyAuth: config.appKeyAuth,
  },
})
CONFIG.unstableOperations = {
  'v2.listIncidents': true,
  'v2.getIncident': true,
}
if (config.site != null) {
  CONFIG.setServerVariables({
    site: config.site,
  })
}
const API_INSTANCE = new v2.IncidentsApi(CONFIG)

type IncidentToolHandlers = ToolHandlers<IncidentToolName>

export const INCIDENT_HANDLERS: IncidentToolHandlers = {
  list_incidents: async (request) => {
    const pageSize = Number(request.params.arguments?.pageSize) || 10
    const pageOffset = Number(request.params.arguments?.pageOffset) || 0
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
    const incidentId = request.params.arguments?.incidentId as string
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
