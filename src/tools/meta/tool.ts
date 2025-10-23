import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { createToolSchema } from '../../utils/tool'
import {
  ExecuteInvestigationChainZodSchema,
  DetectAndExecuteChainZodSchema,
  ListInvestigationChainsZodSchema,
} from './schema'
import { INVESTIGATION_CHAINS } from '../../utils/investigation_chains'

type MetaToolName =
  | 'execute_investigation_chain'
  | 'detect_and_execute_chain'
  | 'list_investigation_chains'
type MetaTool = ExtendedTool<MetaToolName>

export const META_TOOLS: MetaTool[] = [
  createToolSchema(
    ExecuteInvestigationChainZodSchema,
    'execute_investigation_chain',
    'Execute a predefined investigation chain for root cause analysis',
  ),
  createToolSchema(
    DetectAndExecuteChainZodSchema,
    'detect_and_execute_chain',
    'Automatically detect and execute the appropriate investigation chain based on user input',
  ),
  createToolSchema(
    ListInvestigationChainsZodSchema,
    'list_investigation_chains',
    'List all available investigation chains for root cause analysis',
  ),
] as const

type MetaToolHandlers = ToolHandlers<MetaToolName>

export const createMetaToolHandlers = (): MetaToolHandlers => {
  return {
    /**
     * List all available investigation chains
     */
    list_investigation_chains: async (request) => {
      const { detailed } = ListInvestigationChainsZodSchema.parse(
        request.params.arguments,
      )

      const chains = Object.entries(INVESTIGATION_CHAINS).map(([id, chain]) => {
        if (detailed) {
          return {
            id,
            name: chain.name,
            description: chain.description,
            trigger: chain.trigger,
            steps: chain.steps.map((step) => ({
              name: step.name,
              tool: step.tool,
              description: step.description,
              ...(step.conditional ? { conditional: step.conditional } : {}),
            })),
          }
        } else {
          return {
            id,
            name: chain.name,
            description: chain.description,
            trigger: chain.trigger,
            stepCount: chain.steps.length,
          }
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: `Investigation Chains: ${JSON.stringify(chains)}`,
          },
        ],
      }
    },

    // The other two handlers are implemented directly in the server's CallToolRequestSchema handler
    // since they need access to all tool handlers

    execute_investigation_chain: async () => {
      throw new Error('This handler is implemented at the server level')
    },

    detect_and_execute_chain: async () => {
      throw new Error('This handler is implemented at the server level')
    },
  }
}
