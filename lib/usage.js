// lib/usage.js — Pure functions for token-usage sanitization.
// Zero imports, zero side-effects, testable without runtime context.

export const FIELDS = [
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
]

/**
 * Словарь привычных чужих имён для счётчиков токенов.
 *
 * Каждый LLM-провайдер называет расход на свой лад. Харнесс ждёт camelCase, а
 * остальные для него — пустое место, хотя число лежит рядом. Прежде чем
 * подставлять ноль, стоит поискать его здесь: ноль — это признание поражения, а
 * не первый ход.
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
 * Годное значение счётчика: конечное неотрицательное ЦЕЛОЕ число.
 * Значения меньше нуля (-1 и т.д.), нечисловые, а также дробные числа (floats)
 * не признаются годными, так как схема ядра DSH требует z.number().int().nonnegative().
 */
export function sound(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

/**
 * Безопасное приведение значения к корректному неотрицательному целому числу.
 * Округляет дробные числа и парсит числовые строки (в т.ч. с десятичной точкой).
 * Исключает NaN, Infinity, отрицательные величины и мусорные строки.
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
 * Достать порцию расхода из события сессии — по тем же двум местам, где её ищет
 * харнесс.
 *
 * @returns `{ usage, turn, step, at }`, где `at` — путь до порции внутри
 *          события, или `null`, если расхода в событии нет.
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
 * Какие счётчики порции испорчены или превышают допустимый порог maxStepTokens.
 *
 * Отсутствие кэш-полей нарушением не считается: их не присылает добрая половина
 * провайдеров, и харнесс сам подставляет там ноль. Ругаемся только на то, что
 * действительно ломает сложение, — на пропущенные, нечисловые, нецелые или
 * отрицательные значения.
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
 * Число под одним из привычных чужих имён, вложенных структур или числовых строк/дробей.
 * Возвращает валидное целое неотрицательное число или `undefined`, если его там нет.
 */
export function borrowed(usage, field) {
  if (!usage || typeof usage !== 'object') return undefined

  // 1. Поиск по известным синонимам
  for (const alias of ALIASES[field] ?? []) {
    const num = coerceNumber(usage[alias])
    if (num !== undefined) return num
  }

  // 2. Поиск во вложенных деталях кэша (OpenAI-style: prompt_tokens_details.cached_tokens / cachedTokens)
  if (field === 'cacheReadTokens' && usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
    const details = usage.prompt_tokens_details
    const num = coerceNumber(details.cached_tokens ?? details.cachedTokens ?? details.cache_read_tokens)
    if (num !== undefined) return num
  }

  // 3. Поиск во вложенных деталях создания кэша (cache_creation_input_tokens)
  if (field === 'cacheWriteTokens' && usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
    const details = usage.prompt_tokens_details
    const num = coerceNumber(details.cache_creation_tokens ?? details.cacheCreationTokens)
    if (num !== undefined) return num
  }

  // 4. Само поле, если оно было передано валидной строкой или нецелым числом (напр. "123" или 15.4)
  const selfNum = coerceNumber(usage[field])
  if (selfNum !== undefined) return selfNum

  return undefined
}

/**
 * Порция с обезвреженными счётчиками и опциональным ограничением maxStepTokens.
 *
 * Сначала ищем число под чужим именем или нормализуем само поле (округление float/string),
 * и только если его нет — ставим ноль.
 * Чиним арифметику, а не переписываем остальной ответ провайдера.
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
 * Событие с обезвреженной порцией — или то же самое событие, если чинить
 * нечего.
 *
 * Копия поверхностная и ровно по тому пути, где лежит расход: складыванию
 * достаётся исправное событие, а всё остальное в нём — та же ссылка, что и
 * была.
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

/** Безопасная сериализация для журнала: предотвращает сбои на циклических объектах и BigInt. */
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

/** Короткая строка для журнала: по ней видно, кого звать к ответу. */
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
