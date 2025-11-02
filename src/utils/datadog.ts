import { client } from '@datadog/datadog-api-client'

interface CreateDatadogConfigParams {
  apiKeyAuth: string
  appKeyAuth: string
  site?: string
  subdomain?: string
}

export function createDatadogConfig(
  config: CreateDatadogConfigParams,
): client.Configuration {
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

  if (config.subdomain != null) {
    datadogConfig.setServerVariables({
      subdomain: config.subdomain,
    })
  }

  datadogConfig.unstableOperations = {
    'v2.listIncidents': true,
    'v2.getIncident': true,
  }

  return datadogConfig
}

export function getDatadogSite(ddConfig: client.Configuration): string {
  const config = ddConfig.servers[0]?.getConfiguration()
  if (config == null) {
    throw new Error('Datadog site is not set')
  }
  return config.site
}
