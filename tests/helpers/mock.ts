interface MockToolRequest {
  method: 'tools/call'
  params: {
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arguments: Record<string, any>
  }
}

export function createMockToolRequest(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>,
): MockToolRequest {
  return {
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  }
}
