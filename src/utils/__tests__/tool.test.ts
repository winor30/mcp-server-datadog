import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { createToolSchema } from '../tool' // Import createToolSchema function
import { z } from 'zod'

describe('createToolSchema', () => {
  it('should generate tool schema with correct inputSchema when definitions exist', () => {
    // Create a dummy schema with a matching definition for the tool name
    const dummySchema = z.object({
      foo: z.string().describe('foo description'),
      bar: z.number().describe('bar description').optional(),
      baz: z.boolean().describe('baz description').default(false),
      qux: z.number().describe('qux description').min(10).max(20).default(15),
    })

    // Call createToolSchema with the dummy schema, tool name, and description
    const gotTool = createToolSchema(
      dummySchema,
      'test',
      'dummy test description',
    )

    // Expected inputSchema based on the dummy schema
    const expectedInputSchema: Tool = {
      name: 'test',
      description: 'dummy test description',
      inputSchema: {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            description: 'foo description',
          },
          bar: {
            type: 'number',
            description: 'bar description',
          },
          baz: {
            type: 'boolean',
            description: 'baz description',
            default: false,
          },
          qux: {
            type: 'number',
            description: 'qux description',
            default: 15,
            minimum: 10,
            maximum: 20,
          },
        },
        required: ['foo'],
      },
    }

    // Verify the returned tool object matches expected structure
    expect(gotTool).toEqual(expectedInputSchema)
  })
})
