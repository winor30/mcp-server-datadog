import {
  ApiKeyAuthAuthentication,
  AppKeyAuthAuthentication,
} from '@datadog/datadog-api-client/dist/packages/datadog-api-client-common'
import { createDatadogConfig, getDatadogSite } from '../datadog'

describe('createDatadogConfig', () => {
  it('should create a datadog config with custom site when DATADOG_SITE is configured', () => {
    const datadogConfig = createDatadogConfig({
      apiKeyAuth: 'test-api-key',
      appKeyAuth: 'test-app-key',
      site: 'us3.datadoghq.com',
    })
    expect(datadogConfig.authMethods).toEqual({
      apiKeyAuth: new ApiKeyAuthAuthentication('test-api-key'),
      appKeyAuth: new AppKeyAuthAuthentication('test-app-key'),
    })
    expect(datadogConfig.servers[0]?.getConfiguration()?.site).toBe(
      'us3.datadoghq.com',
    )
  })

  it('should create a datadog config with default site when DATADOG_SITE is not configured', () => {
    const datadogConfig = createDatadogConfig({
      apiKeyAuth: 'test-api-key',
      appKeyAuth: 'test-app-key',
    })
    expect(datadogConfig.authMethods).toEqual({
      apiKeyAuth: new ApiKeyAuthAuthentication('test-api-key'),
      appKeyAuth: new AppKeyAuthAuthentication('test-app-key'),
    })
    expect(datadogConfig.servers[0]?.getConfiguration()?.site).toBe(
      'datadoghq.com',
    )
  })

  it('should throw an error when DATADOG_API_KEY are not configured', () => {
    expect(() =>
      createDatadogConfig({
        apiKeyAuth: '',
        appKeyAuth: 'test-app-key',
      }),
    ).toThrow('Datadog API key and APP key are required')
  })

  it('should throw an error when DATADOG_APP_KEY are not configured', () => {
    expect(() =>
      createDatadogConfig({
        apiKeyAuth: 'test-api-key',
        appKeyAuth: '',
      }),
    ).toThrow('Datadog API key and APP key are required')
  })
})

describe('getDatadogSite', () => {
  it('should return custom site when DATADOG_SITE is configured', () => {
    const datadogConfig = createDatadogConfig({
      apiKeyAuth: 'test-api-key',
      appKeyAuth: 'test-app-key',
      site: 'us3.datadoghq.com',
    })
    const site = getDatadogSite(datadogConfig)
    expect(site).toBe('us3.datadoghq.com')
  })

  it('should return default site when DATADOG_SITE is not configured', () => {
    const datadogConfig = createDatadogConfig({
      apiKeyAuth: 'test-api-key',
      appKeyAuth: 'test-app-key',
    })
    const site = getDatadogSite(datadogConfig)
    expect(site).toBe('datadoghq.com')
  })
})
