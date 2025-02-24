import { client } from '@datadog/datadog-api-client'

const config = {
  apiKeyAuth: process.env.DATADOG_API_KEY,
  appKeyAuth: process.env.DATADOG_APP_KEY,
  site: process.env.DATADOG_SITE,
}

if (!config.apiKeyAuth || !config.appKeyAuth) {
  throw new Error('Datadog API key and APP key are required')
}

const datadogConfig = client.createConfiguration({
  authMethods: {
    apiKeyAuth: config.apiKeyAuth,
    appKeyAuth: config.appKeyAuth,
  },
})

if (config.site != null) {
  datadogConfig.setServerVariables({
    site: config.site,
  })
}

datadogConfig.unstableOperations = {
  'v2.listIncidents': true,
  'v2.getIncident': true,
}

export { datadogConfig }
