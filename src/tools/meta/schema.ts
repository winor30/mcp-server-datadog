import { z } from 'zod'

/**
 * Schema for executing an investigation chain
 * This allows direct execution of a predefined investigation sequence
 *
 * @param chainId - The ID of the investigation chain to execute
 * @param initialVariables - Initial variables to populate in the context
 */
export const ExecuteInvestigationChainZodSchema = z.object({
  chainId: z
    .string()
    .describe(
      'The ID of the investigation chain to execute (e.g., monitor_alert, error_log)',
    ),
  initialVariables: z
    .record(z.any())
    .optional()
    .default({})
    .describe('Initial variables to populate in the context'),
})

/**
 * Schema for auto-detecting and executing an investigation chain
 * This analyzes user input to determine the appropriate chain
 *
 * @param userInput - The user's query or request to analyze
 */
export const DetectAndExecuteChainZodSchema = z.object({
  userInput: z
    .string()
    .describe('The user query or request to analyze for chain detection'),
})

/**
 * Schema for listing available investigation chains
 * This provides information about predefined investigation sequences
 */
export const ListInvestigationChainsZodSchema = z.object({
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include detailed step information'),
})
