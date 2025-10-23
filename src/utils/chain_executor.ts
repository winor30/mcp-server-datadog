/**
 * Chain executor for running investigation chains
 * This module handles the execution of pre-defined investigation chains
 */

import {
  InvestigationChain,
  InvestigationStep,
  INVESTIGATION_CHAINS,
} from './investigation_chains'
import { ToolHandlers } from './types'
import { log } from './helper'

/**
 * Result of a chain execution step
 */
interface StepResult {
  stepName: string
  toolName: string
  params: Record<string, unknown>
  result: unknown
  success: boolean
  error?: string
  duration: number
}

/**
 * Context for chain execution
 * Stores variables and state during chain execution
 */
export interface ChainContext {
  chainId: string
  chainName: string
  variables: Record<string, unknown>
  results: StepResult[]
  startTime: number
  currentStep: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
}

/**
 * Chain execution options
 */
export interface ChainExecutionOptions {
  /**
   * Initial variables to populate in the context
   */
  initialVariables?: Record<string, unknown>

  /**
   * Whether to continue execution if a step fails
   */
  continueOnFailure?: boolean

  /**
   * Timeout for the entire chain execution in milliseconds
   */
  timeoutMs?: number

  /**
   * Execution mode - parallel or sequential
   */
  mode?: 'parallel' | 'sequential'

  /**
   * Maximum number of parallel steps to execute at once
   */
  maxParallelSteps?: number
}

/**
 * The default execution options
 */
const DEFAULT_OPTIONS: ChainExecutionOptions = {
  initialVariables: {},
  continueOnFailure: true,
  timeoutMs: 60000 * 5, // 5 minutes
  mode: 'sequential',
  maxParallelSteps: 3,
}

/**
 * Detects the most appropriate investigation chain based on user request and context
 * @param userInput User's request text
 * @param context Additional context from the conversation
 * @returns The detected chain ID and initial variables, or null if no chain is detected
 */
export function detectChain(
  userInput: string,
): { chainId: string; initialVariables: Record<string, unknown> } | null {
  // Normalize input
  const input = userInput.toLowerCase()
  let detectedChainId: string | null = null
  const initialVariables: Record<string, unknown> = {}

  // Monitor alert detection
  const monitorMatch = input.match(
    /(?:monitor(?:s|_id)?[:=\s]\s*(\d+)|alert.*?monitor.*?(\d+))/i,
  )
  if (monitorMatch) {
    detectedChainId = 'monitor_alert'
    initialVariables.monitor_id = monitorMatch[1] || monitorMatch[2]

    // Try to extract alert time if available
    const timeMatch = input.match(
      /(?:at|around|triggered)\s+(\d{1,2}:\d{2}(?:am|pm)?)/i,
    )
    if (timeMatch) {
      initialVariables.alert_time_str = timeMatch[1]
    }

    return { chainId: detectedChainId, initialVariables }
  }

  // Error log investigation
  const errorLogMatch = input.match(
    /(?:error(?:s|_id|_type)?[:=\s]\s*["']?([\w\s.:-]+)["']?|log.*?error.*?([\w\s.:-]+))/i,
  )
  if (
    errorLogMatch ||
    /investigate.*error|analyze.*log|debug.*issue/i.test(input)
  ) {
    detectedChainId = 'error_log'
    if (errorLogMatch) {
      initialVariables.error_type = errorLogMatch[1] || errorLogMatch[2]
    }

    // Extract log ID if available
    const logIdMatch = input.match(
      /log(?:_id)?[:=\s]\s*["']?([a-zA-Z0-9-_]+)["']?/i,
    )
    if (logIdMatch) {
      initialVariables.log_id = logIdMatch[1]
    }

    return { chainId: detectedChainId, initialVariables }
  }

  // Performance regression detection
  if (
    /(?:performance|degradation|slowdown|regression|latency|slow|delay|timeout)/i.test(
      input,
    )
  ) {
    detectedChainId = 'performance_regression'

    // Extract service if mentioned
    const serviceMatch = input.match(
      /(?:service|app|api|endpoint)[:=\s]\s*["']?([\w-]+)["']?/i,
    )
    if (serviceMatch) {
      initialVariables.primary_service = serviceMatch[1]
      initialVariables.service_filter = `service:${serviceMatch[1]}`
    }

    return { chainId: detectedChainId, initialVariables }
  }

  // New error type investigation
  if (
    /(?:new|novel|unknown|unfamiliar|never\s+seen|first\s+time).*?(?:error|exception|failure)/i.test(
      input,
    )
  ) {
    detectedChainId = 'new_error'

    // Extract service if mentioned
    const serviceMatch = input.match(
      /(?:service|app|api|endpoint)[:=\s]\s*["']?([\w-]+)["']?/i,
    )
    if (serviceMatch) {
      initialVariables.affected_service = serviceMatch[1]
    }

    return { chainId: detectedChainId, initialVariables }
  }

  // Service dependency investigation
  if (/(?:dependency|dependent|relies\s+on|upstream|downstream)/i.test(input)) {
    detectedChainId = 'service_dependency'

    // Extract primary service
    const serviceMatch = input.match(
      /(?:service|app|api|endpoint)[:=\s]\s*["']?([\w-]+)["']?/i,
    )
    if (serviceMatch) {
      initialVariables.primary_service = serviceMatch[1]
    }

    return { chainId: detectedChainId, initialVariables }
  }

  // Infrastructure investigation
  if (
    /(?:infrastructure|server|host|node|hardware|capacity|scaling)/i.test(input)
  ) {
    detectedChainId = 'infrastructure'
    return { chainId: detectedChainId, initialVariables }
  }

  // No chain detected
  return null
}

/**
 * Executes an investigation chain
 * @param chainId The ID of the chain to execute
 * @param toolHandlers The tool handlers to use for execution
 * @param options Execution options
 * @returns The execution context with results
 */
export async function executeChain(
  chainId: string,
  toolHandlers: ToolHandlers,
  options?: ChainExecutionOptions,
): Promise<ChainContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chain = INVESTIGATION_CHAINS[chainId]

  if (!chain) {
    throw new Error(`Investigation chain "${chainId}" not found`)
  }

  // Initialize execution context
  const context: ChainContext = {
    chainId,
    chainName: chain.name,
    variables: {
      ...opts.initialVariables,
      current_time: Math.floor(Date.now() / 1000),
    },
    results: [],
    startTime: Date.now(),
    currentStep: 0,
    totalSteps: chain.steps.length,
    completedSteps: 0,
    failedSteps: 0,
  }

  log('info', `Starting investigation chain: ${chain.name}`)

  if (opts.mode === 'parallel') {
    await executeParallel(chain, context, toolHandlers, opts)
  } else {
    await executeSequential(chain, context, toolHandlers, opts)
  }

  log('info', `Completed investigation chain: ${chain.name}`)
  log(
    'info',
    `Steps completed: ${context.completedSteps}/${context.totalSteps}`,
  )

  if (context.failedSteps > 0) {
    log('warn', `Failed steps: ${context.failedSteps}`)
  }

  return context
}

/**
 * Executes chain steps sequentially
 */
async function executeSequential(
  chain: InvestigationChain,
  context: ChainContext,
  toolHandlers: ToolHandlers,
  options: ChainExecutionOptions,
): Promise<void> {
  const { continueOnFailure, timeoutMs } = options
  const chainTimeout = setTimeout(() => {
    log('warn', `Chain execution timed out after ${timeoutMs}ms`)
  }, timeoutMs || 300000)

  try {
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i]
      context.currentStep = i + 1

      // Check if we should skip this step based on conditional
      if (
        step.conditional &&
        !evaluateCondition(step.conditional, context.variables)
      ) {
        log('info', `Skipping step ${i + 1}: ${step.name} (condition not met)`)
        continue
      }

      try {
        log('info', `Executing step ${i + 1}: ${step.name}`)
        const result = await executeStep(step, context, toolHandlers)
        context.results.push(result)

        if (result.success) {
          context.completedSteps++

          // Extract outputs if specified
          if (step.outputs && Array.isArray(step.outputs)) {
            extractOutputs(result.result, step.outputs, context.variables)
          }
        } else {
          context.failedSteps++
          if (!continueOnFailure) {
            break
          }
        }
      } catch (error) {
        context.failedSteps++
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        context.results.push({
          stepName: step.name,
          toolName: step.tool,
          params: resolveParams(step.params, context.variables),
          result: null,
          success: false,
          error: errorMessage,
          duration: 0,
        })

        log(
          'error',
          `Error executing step ${i + 1}: ${step.name}`,
          errorMessage,
        )

        if (!continueOnFailure) {
          break
        }
      }
    }
  } finally {
    clearTimeout(chainTimeout)
  }
}

/**
 * Executes chain steps in parallel with dependencies
 */
async function executeParallel(
  chain: InvestigationChain,
  context: ChainContext,
  toolHandlers: ToolHandlers,
  options: ChainExecutionOptions,
): Promise<void> {
  const { maxParallelSteps, timeoutMs } = options
  const chainTimeout = setTimeout(() => {
    log('warn', `Chain execution timed out after ${timeoutMs}ms`)
  }, timeoutMs || 300000)

  try {
    // Group steps by dependency level (steps that can run in parallel)
    const stepLevels = groupStepsByDependency(chain.steps)

    // Execute each level in sequence, but steps within a level in parallel
    for (let level = 0; level < stepLevels.length; level++) {
      const levelSteps = stepLevels[level]
      const stepPromises: Promise<StepResult>[] = []

      // Execute steps in this level (up to maxParallelSteps at once)
      for (let i = 0; i < levelSteps.length; i += maxParallelSteps || 3) {
        const batchSteps = levelSteps.slice(i, i + (maxParallelSteps || 3))
        const batchPromises = batchSteps.map((step) => {
          // Skip if condition not met
          if (
            step.conditional &&
            !evaluateCondition(step.conditional, context.variables)
          ) {
            log('info', `Skipping step: ${step.name} (condition not met)`)
            return Promise.resolve({
              stepName: step.name,
              toolName: step.tool,
              params: {},
              result: null,
              success: true,
              duration: 0,
            })
          }

          log('info', `Executing step: ${step.name}`)
          return executeStep(step, context, toolHandlers)
        })

        // Wait for this batch to complete before moving to next batch
        const batchResults = await Promise.all(batchPromises)
        stepPromises.push(...batchPromises)

        // Process results from this batch
        for (const result of batchResults) {
          context.results.push(result)

          if (result.success) {
            context.completedSteps++

            // Find the corresponding step to extract outputs
            const step = chain.steps.find((s) => s.name === result.stepName)
            if (step?.outputs && Array.isArray(step.outputs)) {
              extractOutputs(result.result, step.outputs, context.variables)
            }
          } else {
            context.failedSteps++
          }
        }
      }
    }
  } finally {
    clearTimeout(chainTimeout)
  }
}

/**
 * Groups steps by dependency level
 * This determines which steps can be executed in parallel
 */
function groupStepsByDependency(
  steps: InvestigationStep[],
): InvestigationStep[][] {
  // Simple implementation - for now, just put each step in its own level
  // In a more advanced implementation, we would analyze variable dependencies
  return steps.map((step) => [step])
}

/**
 * Executes a single step in the investigation chain
 */
async function executeStep(
  step: InvestigationStep,
  context: ChainContext,
  toolHandlers: ToolHandlers,
): Promise<StepResult> {
  const startTime = Date.now()
  const params = resolveParams(step.params, context.variables)

  try {
    // Create a mock request object for the tool handler
    const request = {
      id: `chain-${context.chainId}-step-${context.currentStep}`,
      method: 'call_tool',
      params: {
        name: step.tool,
        arguments: params,
      },
    }

    // Check if the tool handler exists
    if (!toolHandlers[step.tool]) {
      throw new Error(`Tool handler for "${step.tool}" not found`)
    }

    // Execute the tool handler
    const result = await toolHandlers[step.tool](request)
    const duration = Date.now() - startTime

    return {
      stepName: step.name,
      toolName: step.tool,
      params,
      result,
      success: true,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      stepName: step.name,
      toolName: step.tool,
      params,
      result: null,
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * Resolves parameter templates by replacing variable placeholders with actual values
 */
function resolveParams(
  params: Record<string, unknown>,
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // Replace template strings like {{variable_name}}
      resolved[key] = value.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
        // Support for expressions like {{timestamp - 300}}
        if (varName.includes(' ')) {
          try {
            // Create a function with variables from the context
            const fn = new Function(
              ...Object.keys(variables),
              `return ${varName};`,
            )
            return fn(...Object.values(variables))
          } catch (error) {
            log(
              'warn',
              `Failed to evaluate expression: ${varName}`,
              error instanceof Error ? error.message : String(error),
            )
            return `{{${varName}}}`
          }
        }

        return variables[varName] !== undefined
          ? variables[varName]
          : `{{${varName}}}`
      })
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((item) => {
        if (typeof item === 'string') {
          return item.replace(/\{\{([^}]+)\}\}/g, (_, varName) =>
            variables[varName] !== undefined
              ? variables[varName]
              : `{{${varName}}}`,
          )
        }
        return item
      })
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveParams(value, variables)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

/**
 * Extracts output values from a tool result and stores them in the variables object
 */
function extractOutputs(
  result: unknown,
  outputs: string[],
  variables: Record<string, unknown>,
): void {
  if (!result || typeof result !== 'object') {
    return
  }

  // Extract values from the result based on the content field structure
  if (Array.isArray(result.content)) {
    // Try to parse JSON from text content
    for (const content of result.content) {
      if (content.type === 'text' && content.text) {
        try {
          // Check if this is a JSON string
          if (content.text.includes('{') && content.text.includes('}')) {
            // Extract the JSON part - usually in format "Key: {json}"
            const jsonMatch = content.text.match(/:\s*(\{.+\}|\[.+\])/)
            if (jsonMatch) {
              const jsonStr = jsonMatch[1]
              const parsed = JSON.parse(jsonStr)

              // Extract specified outputs
              for (const output of outputs) {
                if (parsed[output] !== undefined) {
                  variables[output] = parsed[output]
                }
              }
            }
          }
        } catch {
          // Ignore parsing errors, just continue
        }
      }
    }
  }

  // For backward compatibility, also try to extract directly from the result
  for (const output of outputs) {
    if (result[output] !== undefined) {
      variables[output] = result[output]
    }
  }
}

/**
 * Evaluates a conditional expression to determine if a step should be executed
 */
function evaluateCondition(
  condition: string,
  variables: Record<string, unknown>,
): boolean {
  try {
    // Create a function with variables from the context
    const fn = new Function(...Object.keys(variables), `return ${condition};`)
    return !!fn(...Object.values(variables))
  } catch (error) {
    log(
      'warn',
      `Failed to evaluate condition: ${condition}`,
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}
