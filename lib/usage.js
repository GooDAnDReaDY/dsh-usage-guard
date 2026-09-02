// Чистая часть заплатки: что считать испорченной порцией расхода и во что её
// превращать. Ни контекста, ни сети — поэтому проверяется тестами целиком.

/**
 * Поля, из которых харнесс собирает свои четыре ведра.
 *
 * Два первых он берёт как есть, два вторых подстраховывает нулём. Отсюда и весь
 * сыр-бор: провайдер, приславший порцию без `inputTokens`, роняет не свой
 * счётчик, а всю историю сессии.
 */
export const FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']

/**
 * Как то же самое число называют другие.
 *
 * Единого имени у расхода нет: одни присылают `inputTokens`, другие
 * `input_tokens`, третьи просто `input`. Харнесс знает одно написание, поэтому
 * остальные для него — пустое место, хотя число лежит рядом. Прежде чем
 * подставлять ноль, стоит поискать его здесь: ноль — это признание поражения, а
 * не первый ход.
 */
const ALIASES = {
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
 * Годное значение счётчика: конечное неотрицательное число.
 * Значения меньше нуля (-1 и т.д.) или нечисловые не признаются годными,
 * так как схема DSH требует nonnegative integer.
 */
function sound(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Приведение значения к корректному неотрицательному числу.
 * Поддерживает числа и строковые представления целых неотрицательных чисел (напр. "1540").
 */
function coerceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const num = Number(value.trim())
    return Number.isFinite(num) && num >= 0 ? num : undefined
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
 * Какие счётчики порции испорчены.
 *
 * Отсутствие кэш-полей нарушением не считается: их не присылает добрая половина
 * провайдеров, и харнесс сам подставляет там ноль. Ругаемся только на то, что
 * действительно ломает сложение, — на пропущенные, нечисловые или отрицательные
 * значения тех полей, которые харнесс берёт без оглядки, либо на невалидные кэш-поля.
 */
export function damage(usage) {
  if (!usage || typeof usage !== 'object') return FIELDS.slice(0, 2)
  const bad = []
  for (const field of FIELDS) {
    const value = usage[field]
    const optional = field !== 'inputTokens' && field !== 'outputTokens'
    if (value === undefined && optional) continue
    if (!sound(value)) bad.push(field)
  }
  return bad
}

/**
 * Число под одним из привычных чужих имён, вложенных структур или строковых чисел.
 * Возвращает валидное неотрицательное число или `undefined`, если его там нет.
 */
export function borrowed(usage, field) {
  if (!usage || typeof usage !== 'object') return undefined

  // 1. Поиск по известным синонимам
  for (const alias of ALIASES[field] ?? []) {
    const num = coerceNumber(usage[alias])
    if (num !== undefined) return num
  }

  // 2. Поиск во вложенных деталях кэша (OpenAI-style: prompt_tokens_details.cached_tokens)
  if (field === 'cacheReadTokens' && usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
    const details = usage.prompt_tokens_details
    const num = coerceNumber(details.cached_tokens ?? details.cachedTokens)
    if (num !== undefined) return num
  }

  // 3. Само поле, если оно было передано валидной строкой (напр. "123")
  const selfNum = coerceNumber(usage[field])
  if (selfNum !== undefined) return selfNum

  return undefined
}

/**
 * Порция с обезвреженными счётчиками.
 *
 * Сначала ищем число под чужим именем, и только если его нет — ставим ноль.
 * Ноль здесь заведомо неправда, но выбор не между точным счётом и
 * приблизительным, а между приблизительным и нечитаемой историей. Остальные
 * поля порции остаются как были: чиним арифметику, а не переписываем ответ
 * провайдера.
 */
export function repaired(usage, bad) {
  const fixed = usage && typeof usage === 'object' ? { ...usage } : {}
  for (const field of bad) {
    const found = usage && typeof usage === 'object' ? borrowed(usage, field) : undefined
    fixed[field] = found === undefined ? 0 : found
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
export function healed(event, bad) {
  const found = usageOf(event)
  if (!found || bad.length === 0) return event
  const usage = repaired(found.usage, bad)

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
      return '[не сериализуется]'
    }
  }
}

/** Короткая строка для журнала: по ней видно, кого звать к ответу. */
export function complaint(found, bad) {
  const where = `ход ${String(found.turn)}, шаг ${String(found.step)}`
  const taken = bad
    .map((field) => (found.usage && borrowed(found.usage, field) !== undefined ? `${field} взят по синониму` : `${field} обнулён`))
    .join('; ')
  return `порция расхода не по форме — ${where}; пришло: ${safeStringify(found.usage)}; ${taken}`
}