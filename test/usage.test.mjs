import assert from 'node:assert/strict'
import test from 'node:test'

import { FIELDS, borrowed, complaint, damage, healed, repaired, usageOf } from '../lib/usage.js'

const chunk = (usage) => ({
  type: 'assistant/chunk',
  data: { turn: 1, step: 2, chunk: { type: 'usage', usage } },
})

const message = (usage) => ({
  type: 'assistant/message',
  data: { turn: 3, step: 4, usage, message: { role: 'assistant' } },
})

test('расход достаётся из обоих мест, где его держит харнесс', () => {
  assert.deepEqual(usageOf(chunk({ inputTokens: 1, outputTokens: 2 })), {
    usage: { inputTokens: 1, outputTokens: 2 }, turn: 1, step: 2, at: 'chunk',
  })
  assert.equal(usageOf(message({ inputTokens: 5, outputTokens: 6 })).at, 'message')
})

test('событие без расхода не считается находкой', () => {
  assert.equal(usageOf({ type: 'assistant/chunk', data: { chunk: { type: 'text' } } }), null)
  assert.equal(usageOf({ type: 'turn/end', data: {} }), null)
  assert.equal(usageOf(null), null)
})

test('целая порция нарушением не считается', () => {
  assert.deepEqual(damage({ inputTokens: 10, outputTokens: 2 }), [])
  assert.deepEqual(damage({ inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }), [])
})

test('пропущенные кэш-поля прощаются, пропущенные основные — нет', () => {
  // Кэш-полей нет у доброй половины провайдеров, и ядро само ставит там ноль.
  assert.deepEqual(damage({ inputTokens: 1, outputTokens: 2 }), [])
  assert.deepEqual(damage({ outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: 1 }), ['outputTokens'])
})

test('нечисловое или отрицательное значение испорчено не меньше пропущенного', () => {
  assert.deepEqual(damage({ inputTokens: Number.NaN, outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: 1, outputTokens: null }), ['outputTokens'])
  assert.deepEqual(damage({ inputTokens: 1, outputTokens: 2, cacheReadTokens: Number.NaN }), ['cacheReadTokens'])
  assert.deepEqual(damage({ inputTokens: '12', outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: Infinity, outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: -1, outputTokens: 2 }), ['inputTokens'], 'отрицательное число бракуется')
  assert.deepEqual(damage({ inputTokens: 10, outputTokens: -5 }), ['outputTokens'], 'отрицательный output бракуется')
})

test('порция целиком не объект — испорчены оба основных счётчика', () => {
  assert.deepEqual(damage(undefined), FIELDS.slice(0, 2))
  assert.deepEqual(damage('нет'), ['inputTokens', 'outputTokens'])
})

test('починка ставит ноль только там, где сломано, и не трогает остального', () => {
  const usage = { outputTokens: 2, modelId: 'какая-то-модель' }
  assert.deepEqual(repaired(usage, ['inputTokens']), {
    inputTokens: 0, outputTokens: 2, modelId: 'какая-то-модель',
  })
  // Исходная порция остаётся нетронутой: чиним копию.
  assert.deepEqual(usage, { outputTokens: 2, modelId: 'какая-то-модель' })
})

test('целое событие возвращается тем же самым', () => {
  const event = chunk({ inputTokens: 1, outputTokens: 2 })
  assert.equal(healed(event, []), event)
})

test('починка события идёт ровно по тому пути, где лежит расход', () => {
  const broken = chunk({ outputTokens: 2 })
  const fixed = healed(broken, ['inputTokens'])
  assert.deepEqual(fixed.data.chunk.usage, { inputTokens: 0, outputTokens: 2 })
  assert.equal(fixed.data.turn, 1)
  assert.equal(fixed.type, 'assistant/chunk')
  // Исходное событие не переписано.
  assert.deepEqual(broken.data.chunk.usage, { outputTokens: 2 })

  const brokenMessage = message({ inputTokens: 5 })
  const fixedMessage = healed(brokenMessage, ['outputTokens'])
  assert.deepEqual(fixedMessage.data.usage, { inputTokens: 5, outputTokens: 0 })
  assert.equal(fixedMessage.data.message, brokenMessage.data.message)
})

test('жалоба называет ход, шаг, поля и то, что реально пришло', () => {
  const found = usageOf(chunk({ outputTokens: 2 }))
  const text = complaint(found, ['inputTokens'])
  assert.match(text, /inputTokens/)
  assert.match(text, /turn 1/)
  assert.match(text, /step 2/)
  assert.match(text, /"outputTokens":2/)
})

test('сложение ядра на починенном событии больше не даёт NaN', () => {
  // Ровно та арифметика, из-за которой история переставала открываться.
  const bucketsFrom = (usage) => ({
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  })

  // Само ведро получает не NaN, а undefined: NaN рождается на следующем шаге,
  // когда ядро прибавляет ведро к накопленному итогу. Проверяем именно это —
  // так выглядела настоящая поломка.
  const broken = usageOf(chunk({ outputTokens: 18 })).usage
  const add = (total, buckets) => total + buckets.uncachedInputTokens
  assert.equal(bucketsFrom(broken).uncachedInputTokens, undefined)
  assert.ok(Number.isNaN(add(0, bucketsFrom(broken))), 'до заплатки итог становится NaN')

  const event = chunk({ outputTokens: 18 })
  const fixed = usageOf(healed(event, damage(broken))).usage
  const buckets = bucketsFrom(fixed)
  for (const value of Object.values(buckets)) {
    assert.ok(Number.isFinite(value), 'после заплатки все ведра — числа')
  }
  assert.equal(add(0, buckets), 0, 'и итог складывается')
})

test('число под чужим именем берётся вместо нуля', () => {
  // Ровно та порция, которую поймал сторож на живом харнессе.
  const usage = { input: 22533, output: 20 }
  assert.deepEqual(damage(usage), ['inputTokens', 'outputTokens'])
  assert.deepEqual(repaired(usage, damage(usage)), {
    input: 22533, output: 20, inputTokens: 22533, outputTokens: 20,
  })
})

test('признаются привычные написания', () => {
  assert.equal(borrowed({ input_tokens: 5 }, 'inputTokens'), 5)
  assert.equal(borrowed({ prompt_tokens: 7 }, 'inputTokens'), 7)
  assert.equal(borrowed({ completionTokens: 9 }, 'outputTokens'), 9)
  assert.equal(borrowed({ cached_tokens: 3 }, 'cacheReadTokens'), 3)
})

test('признаются синонимы Google Gemini API', () => {
  assert.equal(borrowed({ promptTokenCount: 120 }, 'inputTokens'), 120)
  assert.equal(borrowed({ candidatesTokenCount: 45 }, 'outputTokens'), 45)
  assert.equal(borrowed({ cachedContentTokenCount: 30 }, 'cacheReadTokens'), 30)
})

test('признаются синонимы Ollama native API', () => {
  assert.equal(borrowed({ prompt_eval_count: 55 }, 'inputTokens'), 55)
  assert.equal(borrowed({ eval_count: 88 }, 'outputTokens'), 88)
})

test('признаются вложенные структуры кэша OpenAI (prompt_tokens_details)', () => {
  const usage = {
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_tokens_details: { cached_tokens: 64 },
  }
  assert.equal(borrowed(usage, 'cacheReadTokens'), 64)
})

test('числовые строки безопасно приводятся к числу', () => {
  const usage = { inputTokens: '1540', outputTokens: '20' }
  const bad = damage(usage)
  assert.deepEqual(bad, ['inputTokens', 'outputTokens'])
  const fixed = repaired(usage, bad)
  assert.deepEqual(fixed, {
    inputTokens: 1540,
    outputTokens: 20,
  })
  assert.equal(typeof fixed.inputTokens, 'number')
  assert.equal(typeof fixed.outputTokens, 'number')
})

test('отрицательное число в порции заменяется на 0', () => {
  const usage = { inputTokens: -10, outputTokens: 50 }
  const bad = damage(usage)
  assert.deepEqual(bad, ['inputTokens'])
  const fixed = repaired(usage, bad)
  assert.deepEqual(fixed, { inputTokens: 0, outputTokens: 50 })
})

test('синоним с мусором внутри не признаётся', () => {
  assert.equal(borrowed({ input: null }, 'inputTokens'), undefined)
  assert.equal(borrowed({ input: 'не_число' }, 'inputTokens'), undefined)
  assert.equal(borrowed({ input: -5 }, 'inputTokens'), undefined)
  assert.equal(borrowed({}, 'inputTokens'), undefined)
})

test('нуль остаётся, когда взять неоткуда', () => {
  assert.deepEqual(repaired({ outputTokens: 2 }, ['inputTokens']), { inputTokens: 0, outputTokens: 2 })
})

test('жалоба различает взятое по синониму и обнулённое', () => {
  const found = usageOf({
    type: 'assistant/chunk',
    data: { turn: 1, step: 1, chunk: { type: 'usage', usage: { input: 100 } } },
  })
  const text = complaint(found, damage(found.usage))
  assert.match(text, /inputTokens recovered via alias/)
  assert.match(text, /outputTokens zeroed/)
})

test('жалоба не падает на циклических структурах или BigInt', () => {
  const circular = { turn: 1, step: 1 }
  circular.self = circular
  const foundCircular = { usage: circular, turn: 1, step: 1, at: 'chunk' }
  assert.doesNotThrow(() => complaint(foundCircular, ['inputTokens']))

  const bigintUsage = { count: 100n }
  const foundBigInt = { usage: bigintUsage, turn: 1, step: 1, at: 'chunk' }
  assert.doesNotThrow(() => complaint(foundBigInt, ['inputTokens']))
})
test('дробное число (float) в порции округляется до целого неотрицательного числа', () => {
  const usage = { inputTokens: 42.6, outputTokens: 10.2, cacheReadTokens: 0.8 }
  const bad = damage(usage)
  assert.deepEqual(bad, ['inputTokens', 'outputTokens', 'cacheReadTokens'])
  const fixed = repaired(usage, bad)
  assert.deepEqual(fixed, { inputTokens: 43, outputTokens: 10, cacheReadTokens: 1 })
  assert.ok(Number.isInteger(fixed.inputTokens))
  assert.ok(Number.isInteger(fixed.outputTokens))
  assert.ok(Number.isInteger(fixed.cacheReadTokens))
})

test('строковое дробное число безопасно округляется до целого числа', () => {
  const usage = { inputTokens: '1540.8', outputTokens: '99.1' }
  const bad = damage(usage)
  assert.deepEqual(bad, ['inputTokens', 'outputTokens'])
  const fixed = repaired(usage, bad)
  assert.deepEqual(fixed, { inputTokens: 1541, outputTokens: 99 })
  assert.ok(Number.isInteger(fixed.inputTokens))
  assert.ok(Number.isInteger(fixed.outputTokens))
})
test('признаются вложенные структуры prompt_tokens_details.cachedTokens и cacheCreationTokens', () => {
  const usage = {
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_tokens_details: {
      cachedTokens: 48,
      cacheCreationTokens: 16,
    },
  }
  const bad = damage(usage)
  assert.deepEqual(bad, ['inputTokens', 'outputTokens'])
  const fixed = repaired(usage, bad)
  assert.equal(fixed.inputTokens, 100)
  assert.equal(fixed.outputTokens, 20)
  assert.equal(borrowed(usage, 'cacheReadTokens'), 48)
  assert.equal(borrowed(usage, 'cacheWriteTokens'), 16)
})

test('coerceNumber и borrowed безопасно фильтруют Infinity, NaN и мусорные строки', () => {
  assert.equal(borrowed({ inputTokens: Infinity }, 'inputTokens'), undefined)
  assert.equal(borrowed({ inputTokens: -Infinity }, 'inputTokens'), undefined)
  assert.equal(borrowed({ inputTokens: '1e5' }, 'inputTokens'), undefined)
  assert.equal(borrowed({ inputTokens: '   ' }, 'inputTokens'), undefined)
  assert.equal(borrowed({ inputTokens: '123abc' }, 'inputTokens'), undefined)
  assert.equal(borrowed({ inputTokens: '0' }, 'inputTokens'), 0)
  assert.equal(borrowed({ inputTokens: 0 }, 'inputTokens'), 0)
})

test('поврежденное или пустое событие в healed возвращается неизменным', () => {
  assert.equal(healed(null, []), null)
  assert.equal(healed(undefined, []), undefined)
  const empty = {}
  assert.equal(healed(empty, []), empty)
  const dummy = { type: 'custom/event', data: {} }
  assert.equal(healed(dummy, ['inputTokens']), dummy)
})

test('damage и repaired ограничивают аномальные спайки токенов при maxStepTokens', () => {
  const usage = {
    inputTokens: 2500000,
    outputTokens: 50,
  }
  const bad = damage(usage, 1000000)
  assert.ok(bad.clamped)
  assert.equal(bad.clamped.inputTokens.from, 2500000)
  assert.equal(bad.clamped.inputTokens.to, 1000000)

  const fixed = repaired(usage, bad, 1000000)
  assert.equal(fixed.inputTokens, 1000000)
  assert.equal(fixed.outputTokens, 50)
})

test('при maxStepTokens = 0 ограничение спайков отключено', () => {
  const usage = {
    inputTokens: 5000000,
    outputTokens: 100,
  }
  const bad = damage(usage, 0)
  assert.equal(bad.length, 0)
  assert.equal(bad.clamped, undefined)
  const fixed = repaired(usage, bad, 0)
  assert.equal(fixed.inputTokens, 5000000)
})

test('complaint формирует сообщение об обрезке спайка токенов', () => {
  const usage = { inputTokens: 3000000 }
  const bad = damage(usage, 1000000)
  const msg = complaint({ turn: 4, step: 2, usage }, bad)
  assert.match(msg, /clamped abnormally large/)
  assert.match(msg, /3000000 -> 1000000/)
})
