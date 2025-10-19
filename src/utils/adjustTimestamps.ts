// adjustTimestamps set the timeframe to end at the evaluation timestamp. Return not OK if the resulting timeframe is invalid.
export const adjustTimestamps = (
  from: number,
  to: number,
): { ok: false } | { ok: true; from: number; to: number } => {
  const evalTimestamp = process.env.DATADOG_EVAL_TIMESTAMP

  if (evalTimestamp === undefined) {
    throw new Error('[MCP Eval Version] DATADOG_EVAL_TIMESTAMP must be set')
  }

  const evalSecs = Math.floor(new Date(evalTimestamp).getTime() / 1000)

  const adjustedTo = Math.min(to, evalSecs)

  // Calculate the original interval
  const interval = to - from

  // Adjust 'from' to maintain the same interval, but ensure it's not negative
  const adjustedFrom = Math.max(0, adjustedTo - interval)

  // If the requested timeframe is entirely after the eval timestamp,
  // adjust to show the last 'interval' seconds before eval timestamp
  if (from > evalSecs) {
    const cappedInterval = Math.min(interval, evalSecs)
    return {
      ok: true,
      from: evalSecs - cappedInterval,
      to: evalSecs,
    }
  }

  if (adjustedTo <= adjustedFrom) {
    return { ok: false }
  }

  return {
    ok: true,
    from: adjustedFrom,
    to: adjustedTo,
  }
}
