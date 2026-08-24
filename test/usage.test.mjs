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

test('нечисловое значение испорчено не меньше пропущенного', () => {
  assert.deepEqual(damage({ inputTokens: Number.NaN, outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: 1, outputTokens: null }), ['outputTokens'])
  assert.deepEqual(damage({ inputTokens: 1, outputTokens: 2, cacheReadTokens: Number.NaN }), ['cacheReadTokens'])
  assert.deepEqual(damage({ inputTokens: '12', outputTokens: 2 }), ['inputTokens'])
  assert.deepEqual(damage({ inputTokens: Infinity, outputTokens: 2 }), ['inputTokens'])
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
  assert.match(text, /ход 1/)
  assert.match(text, /шаг 2/)
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

test('синоним с мусором внутри не признаётся', () => {
  assert.equal(borrowed({ input: null }, 'inputTokens'), undefined)
  assert.equal(borrowed({ input: '22533' }, 'inputTokens'), undefined)
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
  assert.match(text, /inputTokens взят по синониму/)
  assert.match(text, /outputTokens обнулён/)
})
