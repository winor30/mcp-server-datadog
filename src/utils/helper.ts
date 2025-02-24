import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { ZodSchema } from 'zod'

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

type JsonSchema = Record<string, any>

function pickRootObjectProperty(
  fullSchema: JsonSchema,
  schemaName: string,
): { type: 'object'; properties: any; required?: string[] } {
  const definitions = fullSchema.definitions ?? {}
  const root = definitions[schemaName]
  return {
    type: 'object',
    properties: root?.properties ?? {},
    required: root?.required ?? [],
  }
}

/**
 * Creates a tool definition object using the provided Zod schema.
 *
 * This function converts a Zod schema (acting as the single source of truth) into a JSON Schema,
 * extracts the relevant root object properties, and embeds them into the tool definition.
 * This approach avoids duplicate schema definitions and ensures type safety and consistency.
 *
 * Note: The provided name is also used as the tool's name in the Model Context Protocol.
 *
 * @param schema - The Zod schema representing the tool's parameters.
 * @param name - The name of the tool and the key used to extract the corresponding schema definition, and the tool's name in the Model Context Protocol.
 * @param description - A brief description of the tool's functionality.
 * @returns A tool object containing the name, description, and input JSON Schema.
 */
export function createToolSchema<T extends string>(
  schema: ZodSchema<any>,
  name: T,
  description: string,
): Tool & { name: T } {
  return {
    name,
    description,
    inputSchema: pickRootObjectProperty(schema, name),
  }
}
