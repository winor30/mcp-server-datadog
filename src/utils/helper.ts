export function log(severity: 'info' | 'error', ...args: any[]) {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const msg = `[${severity.toUpperCase()} ${new Date().toISOString()}] ${args.join(' ')}\n`
  // mpc server currently use stdio transport
  // so if we use console.log, it will break the stdio transport
  // So we use stderr to write the logging messages.
  process.stderr.write(msg)
}

export const config = {
  apiKeyAuth: process.env.DATADOG_API_KEY,
  appKeyAuth: process.env.DATADOG_APP_KEY,
  site: process.env.DATADOG_SITE,
}

export { version as mcpDatadogVersion } from '../../package.json'
