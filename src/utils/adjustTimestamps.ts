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

  if (adjustedTo < from) {
    return { ok: false }
  }

  return {
    ok: true,
    from,
    to: adjustedTo,
  }
}
