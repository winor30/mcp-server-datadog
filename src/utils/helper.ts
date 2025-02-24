/**
 * Logs a formatted message with a specified severity to stderr.
 *
 * The MCP server uses stdio transport, so using console.log might interfere with the transport.
 * Therefore, logging messages are written to stderr.
 *
 * @param {'info' | 'error'} severity - The severity level of the log message.
 * @param {...any[]} args - Additional arguments to be logged, which will be concatenated into a single string.
 */
export function log(severity: 'info' | 'error', ...args: any[]) {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const msg = `[${severity.toUpperCase()} ${new Date().toISOString()}] ${args.join(' ')}\n`
  process.stderr.write(msg)
}

export const config = {
  apiKeyAuth: process.env.DATADOG_API_KEY,
  appKeyAuth: process.env.DATADOG_APP_KEY,
  site: process.env.DATADOG_SITE,
}

export { version as mcpDatadogVersion } from '../../package.json'
