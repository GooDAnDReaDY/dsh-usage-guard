// lib/usage.js — Pure functions for token-usage sanitization.
// Zero imports, zero side-effects, testable without runtime context.

export const FIELDS = [
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
]

/**
 * Dictionary of common external provider naming variants for token counters.
 *
 * Each LLM provider formats token usage differently. DSH core expects camelCase,
 * and ignores other conventions even if the token count is present under a different key.
 * Instead of immediately falling back to zero, we check known provider aliases first.
 * Setting zero is a last resort to preserve arithmetic, not the primary choice.
 */
export const ALIASES = {
  inputTokens: [
    'input_tokens',
    'input',
    'promptTokens',
    'prompt_tokens',
    'promptTokenCount',
    'prompt_eval_count',
  ],
  outputTokens: [
    'output_tokens',
    'output',
    'completionTokens',
    'completion_tokens',
    'candidatesTokenCount',
    'eval_count',
  ],
  cacheReadTokens: [
    'cache_read_tokens',
    'cachedTokens',
    'cached_tokens',
    'cache_read_input_tokens',
    'cachedContentTokenCount',
  ],
  cacheWriteTokens: [
    'cache_write_tokens',
    'cacheCreationTokens',
    'cache_creation_input_tokens',
  ],
}

/**
 * Valid counter value: a finite, non-negative integer.
 * Negative values, non-numeric values, and floating point numbers are considered invalid
 * as the DSH core schema expects integer counters.
 */
export function sound(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

/**
 * Safely coerces a value to a valid non-negative integer.
 * Rounds floating point numbers and parses numeric strings (including decimals).
 * Filters out NaN, Infinity, negative numbers, and non-numeric strings.
 */
export function coerceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      return Number.isFinite(num) && num >= 0 ? Math.round(num) : undefined
    }
  }
  return undefined
}

/**
 * Extracts the usage sample from a session event by checking both standard DSH locations.
 *
 * @returns `{ usage, turn, step, at }` where `at` indicates the path within the event ('chunk' or 'message'),
 *          or `null` if the event carries no usage data.
 */
export function usageOf(event) {
  if (!event || typeof event !== 'object') return null
  const data = event.data
  if (!data || typeof data !== 'object') return null

  if (event.type === 'assistant/chunk' && data.chunk && data.chunk.type === 'usage') {
    return { usage: data.chunk.usage, turn: data.turn, step: data.step, at: 'chunk' }
  }
  if (event.type === 'assistant/message' && data.usage !== undefined) {
    return { usage: data.usage, turn: data.turn, step: data.step, at: 'message' }
  }
  return null
}

/**
 * Detects which usage counters are malformed or exceed the maxStepTokens ceiling.
 *
 * Omitted cache fields are not considered defects: many providers do not report them,
 * and the harness automatically defaults them to zero. We only flag values that actually
 * break arithmetic operations — missing required counters, non-numbers, non-integers, or negatives.
 */
export function damage(usage, options = {}) {
  if (!usage || typeof usage !== 'object') return FIELDS.slice(0, 2)
  const bad = []
  const maxStepTokens = typeof options === 'number' ? options : (Number(options?.maxStepTokens) > 0 ? Number(options.maxStepTokens) : 0)

  for (const field of FIELDS) {
    const value = usage[field]
    const optional = field !== 'inputTokens' && field !== 'outputTokens'
    if (value === undefined && optional) continue
    if (!sound(value)) {
      bad.push(field)
    } else if (maxStepTokens > 0 && value > maxStepTokens) {
      bad.push(field)
      bad.clamped = bad.clamped || {}
      bad.clamped[field] = { from: value, to: maxStepTokens }
    }
  }
  return bad
}

/**
 * Attempts to borrow a valid counter number from known aliases, nested structures, or numeric strings.
 * Returns a valid non-negative integer or `undefined` if none is found.
 */
export function borrowed(usage, field) {
  if (!usage || typeof usage !== 'object') return undefined

  // 1. Search known alias names
  for (const alias of ALIASES[field] ?? []) {
    const num = coerceNumber(usage[alias])
    if (num !== undefined) return num
  }

  // 2. Search nested cache details (OpenAI-style: prompt_tokens_details.cached_tokens / cachedTokens)
  if (field === 'cacheReadTokens' && usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
    const details = usage.prompt_tokens_details
    const num = coerceNumber(details.cached_tokens ?? details.cachedTokens ?? details.cache_read_tokens)
    if (num !== undefined) return num
  }

  // 3. Search nested cache creation details (cache_creation_input_tokens)
  if (field === 'cacheWriteTokens' && usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
    const details = usage.prompt_tokens_details
    const num = coerceNumber(details.cache_creation_tokens ?? details.cacheCreationTokens)
    if (num !== undefined) return num
  }

  // 4. Check the field itself if passed as a string or float (e.g. "123" or 15.4)
  const selfNum = coerceNumber(usage[field])
  if (selfNum !== undefined) return selfNum

  return undefined
}

/**
 * Returns a usage object with sanitized counters and optional maxStepTokens clamping.
 *
 * We search for a value under known aliases or normalize the existing field first,
 * and only substitute zero if no numeric value can be recovered.
 * This restores arithmetic consistency without mutating unrelated provider response fields.
 */
export function repaired(usage, bad, options = {}) {
  const fixed = usage && typeof usage === 'object' ? { ...usage } : {}
  const maxStepTokens = typeof options === 'number' ? options : (Number(options?.maxStepTokens) > 0 ? Number(options.maxStepTokens) : 0)

  for (const field of bad) {
    const rawVal = usage && typeof usage === 'object' ? usage[field] : undefined
    let found = usage && typeof usage === 'object' ? borrowed(usage, field) : undefined
    let candidate = found === undefined ? 0 : found

    if (maxStepTokens > 0 && candidate > maxStepTokens) {
      candidate = maxStepTokens
    } else if (maxStepTokens > 0 && typeof rawVal === 'number' && rawVal > maxStepTokens && candidate === 0) {
      candidate = maxStepTokens
    }
    fixed[field] = candidate
  }
  return fixed
}

/**
 * Returns an event with sanitized usage, or the exact same event if no repair was needed.
 *
 * Performs a shallow copy only along the exact path holding usage data:
 * state reduction receives the repaired counters while all other event references remain untouched.
 */
export function healed(event, bad, options = {}) {
  const found = usageOf(event)
  if (!found || bad.length === 0) return event
  const usage = repaired(found.usage, bad, options)

  if (found.at === 'chunk') {
    return {
      ...event,
      data: { ...event.data, chunk: { ...event.data.chunk, usage } },
    }
  }
  return { ...event, data: { ...event.data, usage } }
}

/** Safe JSON stringification for logging: guards against circular references and BigInt values. */
function safeStringify(value) {
  try {
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[not serializable]'
    }
  }
}

/** Formats a descriptive log line identifying the turn, step, raw payload, and applied repairs. */
export function complaint(found, bad, options = {}) {
  const where = `turn ${String(found?.turn ?? '-')}, step ${String(found?.step ?? '-')}`
  const usage = found?.usage ?? found
  const maxStepTokens = typeof options === 'number' ? options : (Number(options?.maxStepTokens) > 0 ? Number(options.maxStepTokens) : 0)
  const taken = Array.isArray(bad)
    ? bad
        .map((field) => {
          if (bad?.clamped?.[field]) {
            return `${field} clamped abnormally large (${bad.clamped[field].from} -> ${bad.clamped[field].to})`
          }
          const val = usage?.[field]
          if (maxStepTokens > 0 && typeof val === 'number' && val > maxStepTokens) {
            return `${field} clamped to ${maxStepTokens}`
          }
          return usage && borrowed(usage, field) !== undefined ? `${field} recovered via alias` : `${field} zeroed`
        })
        .join('; ')
    : ''
  return `malformed usage sample — ${where}; received: ${safeStringify(usage)}; ${taken}`
}
