/**
 * Utility functions for log pattern analysis
 */

/**
 * Calculates the Levenshtein distance between two strings
 * @param a First string
 * @param b Second string
 * @returns The edit distance between the strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // Create the distance matrix
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize the first row and column
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      )
    }
  }

  return d[m][n]
}

/**
 * Calculates the similarity between two strings (1.0 = identical, 0.0 = completely different)
 * @param a First string
 * @param b Second string
 * @returns Similarity score between 0.0 and 1.0
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)

  return 1.0 - distance / maxLength
}

/**
 * Finds common tokens across a set of log messages
 * @param messages Array of log messages
 * @returns Object with common and variable parts
 */
export function findCommonTokens(messages: string[]): {
  commonTokens: string[]
  variablePositions: number[]
} {
  if (messages.length === 0) return { commonTokens: [], variablePositions: [] }
  if (messages.length === 1)
    return { commonTokens: messages[0].split(/\s+/), variablePositions: [] }

  // Tokenize messages
  const tokenizedMessages = messages.map((msg) => msg.split(/\s+/))

  // Find the shortest message length to avoid out-of-bounds
  const minLength = Math.min(
    ...tokenizedMessages.map((tokens) => tokens.length),
  )

  const commonTokens: string[] = []
  const variablePositions: number[] = []

  // Process each token position
  for (let i = 0; i < minLength; i++) {
    const tokensAtPosition = tokenizedMessages.map((tokens) => tokens[i])
    const uniqueTokens = new Set(tokensAtPosition)

    if (uniqueTokens.size === 1) {
      // All messages have the same token at this position
      commonTokens.push(tokensAtPosition[0])
    } else {
      // Variable token position
      commonTokens.push('*')
      variablePositions.push(i)
    }
  }

  return { commonTokens, variablePositions }
}

/**
 * Generates a pattern template from a group of similar messages
 * @param messages Array of similar log messages
 * @returns Pattern template with variables marked as placeholders
 */
export function generatePatternTemplate(messages: string[]): string {
  const { commonTokens, variablePositions } = findCommonTokens(messages)

  return commonTokens
    .map((token, index) =>
      variablePositions.includes(index) ? '{{variable}}' : token,
    )
    .join(' ')
}

/**
 * Normalizes a log message for easier pattern matching
 * @param message Raw log message
 * @returns Normalized message with standardized whitespace, etc.
 */
export function normalizeLogMessage(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[0-9]+/g, '{{num}}') // Replace numbers with placeholder
    .replace(/[a-f0-9]{8,}/gi, '{{hex}}') // Replace hex strings
    .replace(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
      '{{uuid}}',
    ) // Replace UUIDs
}

/**
 * Groups messages into clusters based on similarity
 * @param messages Array of log messages
 * @param similarityThreshold Threshold for considering messages similar (0.0-1.0)
 * @returns Array of message clusters
 */
export function clusterSimilarMessages(
  messages: string[],
  similarityThreshold: number,
): string[][] {
  if (messages.length === 0) return []
  if (messages.length === 1) return [messages]

  const normalizedMessages = messages.map(normalizeLogMessage)
  const clusters: string[][] = []
  const assignedIndices = new Set<number>()

  // Process each message
  for (let i = 0; i < normalizedMessages.length; i++) {
    if (assignedIndices.has(i)) continue

    const currentCluster: number[] = [i]
    assignedIndices.add(i)

    // Compare with all other unassigned messages
    for (let j = 0; j < normalizedMessages.length; j++) {
      if (i === j || assignedIndices.has(j)) continue

      const similarity = stringSimilarity(
        normalizedMessages[i],
        normalizedMessages[j],
      )
      if (similarity >= similarityThreshold) {
        currentCluster.push(j)
        assignedIndices.add(j)
      }
    }

    // Add original messages to clusters
    clusters.push(currentCluster.map((idx) => messages[idx]))
  }

  // Sort clusters by size (largest first)
  return clusters.sort((a, b) => b.length - a.length)
}

/**
 * Extracts the most likely error type and message from a log
 * @param logMessage Log message containing error information
 * @returns Extracted error type and message
 */
export function extractErrorSignature(logMessage: string): {
  errorType: string
  errorMessage: string
} {
  // Default values
  let errorType = 'Unknown'
  let errorMessage = logMessage

  // Common error patterns across languages
  const patterns = [
    // JavaScript/TypeScript
    /(?:Error|Exception):\s*([^:]+)(?::(.+))?/i,
    // Java/C#
    /(?:[a-z0-9.]+\.)?([a-z0-9]+(?:Error|Exception))[:\s]+(.+?)(?:\r?\n|$)/i,
    // Python
    /([a-z0-9]+(?:Error|Exception))[:\s]+(.+?)(?:\r?\n|$)/i,
    // Ruby
    /([a-zA-Z0-9:]+Error)[:\s]+(.+?)(?:\r?\n|$)/i,
    // Generic
    /error[:\s]+(.+?)(?:\r?\n|$)/i,
  ]

  // Try each pattern
  for (const pattern of patterns) {
    const match = logMessage.match(pattern)
    if (match) {
      errorType = match[1] || errorType
      errorMessage = match[2] || errorMessage
      break
    }
  }

  return {
    errorType: errorType.trim(),
    errorMessage: errorMessage.trim(),
  }
}

/**
 * Extracts stack trace information from a log message
 * @param logMessage Log message potentially containing a stack trace
 * @param maxFrames Maximum number of stack frames to extract
 * @returns Array of stack frames or empty array if none found
 */
export function extractStackTrace(
  logMessage: string,
  maxFrames: number = 3,
): string[] {
  const stackFrames: string[] = []

  // Common stack trace patterns
  const patterns = [
    // Node.js
    /at\s+([^\s]+)\s+\(([^)]+):(\d+):(\d+)\)/g,
    // Java
    /at\s+([^(]+)\(([^:]+):(\d+)\)/g,
    // Python
    /File\s+"([^"]+)",\s+line\s+(\d+),\s+in\s+([^\n]+)/g,
    // Generic
    /(?:at|in)\s+([^(]+)(?:\(|\[)([^:)]+):(\d+)(?::(\d+))?\)?/g,
  ]

  // Try each pattern
  for (const pattern of patterns) {
    let match
    while (
      (match = pattern.exec(logMessage)) !== null &&
      stackFrames.length < maxFrames
    ) {
      // Extract a normalized representation of the stack frame
      stackFrames.push(match[0].trim())
    }

    if (stackFrames.length > 0) break
  }

  return stackFrames
}

/**
 * Calculates Z-scores for a set of values to detect anomalies
 * @param values Array of numeric values
 * @returns Z-scores for each value
 */
export function calculateZScores(values: number[]): number[] {
  if (values.length <= 1) return [0]

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  const stdDev = Math.sqrt(variance)

  // Avoid division by zero
  if (stdDev === 0) return values.map(() => 0)

  return values.map((val) => (val - mean) / stdDev)
}

/**
 * Detects anomalies in values based on Z-score thresholds
 * @param values Array of numeric values
 * @param sensitivityLevel Sensitivity level (1-10) where higher is more sensitive
 * @returns Indices of anomalous values
 */
export function detectAnomalies(
  values: number[],
  sensitivityLevel: number = 5,
): number[] {
  const zScores = calculateZScores(values)

  // Convert sensitivity (1-10) to Z-score threshold (3.0-1.5)
  // Higher sensitivity = lower threshold = more anomalies
  const threshold = 3.0 - (sensitivityLevel - 1) * (1.5 / 9)

  return zScores
    .map((zscore, index) => ({ zscore: Math.abs(zscore), index }))
    .filter((item) => item.zscore >= threshold)
    .map((item) => item.index)
}

/**
 * Executes a function with a timeout
 * @param func Function to execute
 * @param timeoutMs Timeout in milliseconds
 * @param defaultResult Default result to return if timeout occurs
 * @returns Promise resolving to the function result or default result on timeout
 */
export async function executeWithTimeout<T>(
  func: () => Promise<T>,
  timeoutMs: number,
  defaultResult: T,
): Promise<{ result: T; timedOut: boolean }> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<{ result: T; timedOut: true }>(
    (resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ result: defaultResult, timedOut: true })
      }, timeoutMs)
    },
  )

  try {
    const result = await Promise.race([
      func().then((result) => ({ result, timedOut: false })),
      timeoutPromise,
    ])

    return result
  } finally {
    clearTimeout(timeoutId!)
  }
}
