/**
 * Utility to detect the type of scenario from user input
 * This helps automatically identify what type of RCA analysis is needed
 */

import { getContextSpecificPrompt } from './prompt_guidance'

// Regular expressions for detecting scenario types
const MONITOR_URL_REGEX =
  /(?:app\.datadoghq\.com\/monitors\/(\d+)|monitor(?:s|_id)[:=]\s*(\d+))/i
const LOG_ID_REGEX =
  /(?:log_id[:=]\s*([A-Za-z0-9-_]+)|app\.datadoghq\.com\/logs\/[^/]+\/([A-Za-z0-9-_]+))/i
const REGRESSION_KEYWORDS =
  /(?:regression|degradation|slowdown|getting slower|performance drop)/i
const ANOMALY_KEYWORDS =
  /(?:anomaly|unusual|unexpected|strange pattern|odd behavior)/i

// Regular expressions for monitor types
const AVAILABILITY_KEYWORDS = /(?:availability|uptime|downtime|5xx|error rate)/i
const LATENCY_KEYWORDS = /(?:latency|response time|slow|performance|duration)/i
const ERROR_RATE_KEYWORDS = /(?:error rate|failure rate|exception rate)/i
const ANOMALY_MONITOR_KEYWORDS = /(?:anomaly|outlier|unusual)/i

// Regular expressions for severity
const CRITICAL_KEYWORDS =
  /(?:critical|severe|urgent|p0|p1|highest priority|production down)/i
const WARNING_KEYWORDS = /(?:warning|warn|moderate|p2|medium priority)/i
const INFO_KEYWORDS = /(?:info|low|p3|minor|low priority)/i

/**
 * Detects the scenario type and context from user input
 * @param userInput The user's query or request
 * @returns Scenario context information to generate appropriate guidance
 */
export function detectScenario(userInput: string): {
  scenarioType: 'monitor' | 'log' | 'regression' | 'anomaly' | 'general'
  monitorId?: string
  logId?: string
  monitorType?: 'availability' | 'latency' | 'error_rate' | 'anomaly'
  severity?: 'critical' | 'warning' | 'info'
  timeRange?: {
    from: number
    to: number
  }
} {
  // Initialize result
  const result: {
    scenarioType: 'monitor' | 'log' | 'regression' | 'anomaly' | 'general'
    monitorId?: string
    logId?: string
    monitorType?: 'availability' | 'latency' | 'error_rate' | 'anomaly'
    severity?: 'critical' | 'warning' | 'info'
    timeRange?: {
      from: number
      to: number
    }
  } = {
    scenarioType: 'general',
  }

  // Check for monitor URL or ID
  const monitorMatch = userInput.match(MONITOR_URL_REGEX)
  if (monitorMatch) {
    result.scenarioType = 'monitor'
    result.monitorId = monitorMatch[1] || monitorMatch[2]

    // Try to detect monitor type
    if (AVAILABILITY_KEYWORDS.test(userInput)) {
      result.monitorType = 'availability'
    } else if (LATENCY_KEYWORDS.test(userInput)) {
      result.monitorType = 'latency'
    } else if (ERROR_RATE_KEYWORDS.test(userInput)) {
      result.monitorType = 'error_rate'
    } else if (ANOMALY_MONITOR_KEYWORDS.test(userInput)) {
      result.monitorType = 'anomaly'
    }
  }

  // Check for log ID
  const logMatch = userInput.match(LOG_ID_REGEX)
  if (logMatch && !result.monitorId) {
    result.scenarioType = 'log'
    result.logId = logMatch[1] || logMatch[2]
  }

  // Check for regression analysis request
  if (
    REGRESSION_KEYWORDS.test(userInput) &&
    !result.monitorId &&
    !result.logId
  ) {
    result.scenarioType = 'regression'
  }

  // Check for anomaly detection request
  if (
    ANOMALY_KEYWORDS.test(userInput) &&
    !result.monitorId &&
    !result.logId &&
    result.scenarioType !== 'regression'
  ) {
    result.scenarioType = 'anomaly'
  }

  // Detect severity
  if (CRITICAL_KEYWORDS.test(userInput)) {
    result.severity = 'critical'
  } else if (WARNING_KEYWORDS.test(userInput)) {
    result.severity = 'warning'
  } else if (INFO_KEYWORDS.test(userInput)) {
    result.severity = 'info'
  }

  // Try to detect time range mention
  // This is a simplified approach - in production you'd want more robust time parsing
  const timeRegex = /(?:in the (?:last|past)\s+(\d+)\s+(hour|day|minute)s?)/i
  const timeMatch = userInput.match(timeRegex)
  if (timeMatch) {
    const amount = parseInt(timeMatch[1])
    const unit = timeMatch[2].toLowerCase()

    const now = Math.floor(Date.now() / 1000)
    let from = now

    if (unit === 'minute') {
      from = now - amount * 60
    } else if (unit === 'hour') {
      from = now - amount * 3600
    } else if (unit === 'day') {
      from = now - amount * 86400
    }

    result.timeRange = {
      from,
      to: now,
    }
  }

  return result
}

/**
 * Generates a context-specific prompt based on the detected scenario
 * @param userInput The user's query or request
 * @returns A tailored system prompt for the specific scenario
 */
export function getPromptForInput(userInput: string): string {
  const scenarioContext = detectScenario(userInput)
  return getContextSpecificPrompt(scenarioContext)
}

/**
 * Middleware function that can be used to dynamically update the system prompt
 * based on the detected scenario type from user input
 * @param userInput The user's query or request
 * @param currentPrompt The current system prompt
 * @returns Updated system prompt with scenario-specific guidance
 */
export function adaptivePromptMiddleware(
  userInput: string,
  currentPrompt: string,
): string {
  const scenarioContext = detectScenario(userInput)

  // If we detected a specific scenario type that's not 'general',
  // generate a customized prompt for it
  if (scenarioContext.scenarioType !== 'general') {
    return getContextSpecificPrompt(scenarioContext)
  }

  // Otherwise, keep the current prompt
  return currentPrompt
}
