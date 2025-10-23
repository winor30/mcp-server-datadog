import { describe, it, expect } from 'vitest'
import { createMetaToolHandlers } from '../../src/tools/meta/tool'
import { createMockToolRequest } from '../helpers/mock'
import { DatadogToolResponse } from '../helpers/datadog'
import { INVESTIGATION_CHAINS } from '../../src/utils/investigation_chains'

describe('Meta Tools', () => {
  const toolHandlers = createMetaToolHandlers()

  describe.concurrent('list_investigation_chains', async () => {
    it('should list all investigation chains with basic info', async () => {
      const request = createMockToolRequest('list_investigation_chains', {
        detailed: false,
      })

      const response = (await toolHandlers.list_investigation_chains(
        request,
      )) as unknown as DatadogToolResponse

      expect(response.content[0].text).toContain('Investigation Chains')

      // Make sure all chains are included
      Object.keys(INVESTIGATION_CHAINS).forEach((chainId) => {
        expect(response.content[0].text).toContain(chainId)
      })

      // Should not include detailed step information
      expect(response.content[0].text).not.toContain('params')
    })

    it('should include detailed information when requested', async () => {
      const request = createMockToolRequest('list_investigation_chains', {
        detailed: true,
      })

      const response = (await toolHandlers.list_investigation_chains(
        request,
      )) as unknown as DatadogToolResponse

      expect(response.content[0].text).toContain('Investigation Chains')

      // Should include step information
      expect(response.content[0].text).toContain('steps')
      expect(response.content[0].text).toContain('tool')
      expect(response.content[0].text).toContain('description')
    })
  })

  describe.concurrent('execute_investigation_chain', async () => {
    it('should throw an error as it is implemented at server level', async () => {
      const request = createMockToolRequest('execute_investigation_chain', {
        chainId: 'monitor_alert',
        initialVariables: { monitor_id: 12345 },
      })

      await expect(
        toolHandlers.execute_investigation_chain(request),
      ).rejects.toThrow('This handler is implemented at the server level')
    })
  })

  describe.concurrent('detect_and_execute_chain', async () => {
    it('should throw an error as it is implemented at server level', async () => {
      const request = createMockToolRequest('detect_and_execute_chain', {
        userInput: 'Investigate monitor 12345 that is alerting',
      })

      await expect(
        toolHandlers.detect_and_execute_chain(request),
      ).rejects.toThrow('This handler is implemented at the server level')
    })
  })
})
