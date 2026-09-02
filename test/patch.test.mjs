import assert from 'node:assert/strict'
import test from 'node:test'

import { patchRegistry, wrapApply } from '../lib/patch.js'

/** Реестр в миниатюре: карта записей и та же обезличивающая регистрация. */
function fakeRegistry() {
  return {
    registrations: new Map(),
    register(definition) {
      const erased = {
        key: definition.key,
        apply: (state, event) => definition.apply(state, event),
      }
      this.registrations.set(definition.key, { def: erased, refs: 1 })
      return () => this.registrations.delete(definition.key)
    },
  }
}

/** Складывание, повторяющее промах ядра: два поля берутся без оглядки. */
const meter = {
  key: 'tokenUsage',
  apply: (state, event) => {
    const usage = event.data.chunk.usage
    return {
      input: state.input + usage.inputTokens,
      output: state.output + usage.outputTokens,
    }
  },
}

const brokenEvent = {
  type: 'assistant/chunk',
  data: { turn: 1, step: 1, chunk: { type: 'usage', usage: { outputTokens: 7 } } },
}

/** Обезвреживатель, какой ставит сам плагин, но без настроек и журнала. */
const guard = (event) => {
  const usage = event.data && event.data.chunk && event.data.chunk.usage
  if (!usage || (typeof usage.inputTokens === 'number' && usage.inputTokens >= 0)) return event
  return {
    ...event,
    data: { ...event.data, chunk: { ...event.data.chunk, usage: { ...usage, inputTokens: 0 } } },
  }
}

test('без заплатки сложение даёт NaN — то самое, что валит историю', () => {
  const registry = fakeRegistry()
  registry.register(meter)
  const entry = registry.registrations.get('tokenUsage')
  const out = entry.def.apply({ input: 0, output: 0 }, brokenEvent)
  assert.ok(Number.isNaN(out.input))
})

test('проекция, заведённая ДО заплатки, оборачивается сразу', () => {
  const registry = fakeRegistry()
  registry.register(meter)
  patchRegistry(registry, guard)

  const entry = registry.registrations.get('tokenUsage')
  const out = entry.def.apply({ input: 0, output: 0 }, brokenEvent)
  assert.deepEqual(out, { input: 0, output: 7 })
})

test('проекция, заведённая ПОСЛЕ заплатки, ловится на регистрации', () => {
  const registry = fakeRegistry()
  patchRegistry(registry, guard)
  registry.register(meter)

  const entry = registry.registrations.get('tokenUsage')
  const out = entry.def.apply({ input: 0, output: 0 }, brokenEvent)
  assert.deepEqual(out, { input: 0, output: 7 })
})

test('чужая проекция получает ровно то событие, что пришло', () => {
  // Оборачиваются все проекции — расход читает не только счёт токенов. Цена
  // этого: для события без расхода обезвреживатель обязан быть тождеством.
  const registry = fakeRegistry()
  let seen
  patchRegistry(registry, (event) => event)
  registry.register({ key: 'sessionTitle', apply: (state, event) => { seen = event; return state } })

  const entry = registry.registrations.get('sessionTitle')
  const event = { type: 'turn/end', data: {} }
  assert.equal(entry.def.apply('как было', event), 'как было')
  assert.equal(seen, event, 'событие дошло тем же объектом')
})

test('wrapApply сохраняет контекст this при вызове', () => {
  let capturedThis = null
  const def = {
    tag: 'custom-projection',
    apply(state, event) {
      capturedThis = this
      return state
    },
  }
  wrapApply(def, (e) => e)
  def.apply({}, { type: 'test' })
  assert.equal(capturedThis, def, 'контекст this сохранён')
})

test('снятие возвращает и складывание, и укладку в карту', () => {
  const registry = fakeRegistry()
  registry.register(meter)
  const entry = registry.registrations.get('tokenUsage')

  const undo = patchRegistry(registry, guard)
  undo()

  assert.ok(!Object.hasOwn(registry.registrations, 'set'), 'карта вернулась своя')
  const out = entry.def.apply({ input: 0, output: 0 }, brokenEvent)
  assert.ok(Number.isNaN(out.input), 'складывание вернулось прежнее')
})

test('дважды не оборачиваем', () => {
  const registry = fakeRegistry()
  registry.register(meter)
  const entry = registry.registrations.get('tokenUsage')

  patchRegistry(registry, guard)
  const once = entry.def.apply
  patchRegistry(registry, guard)
  assert.equal(entry.def.apply, once)
})

test('обёртка над чем попало ничего не ломает', () => {
  assert.doesNotThrow(() => wrapApply(undefined, guard)())
  assert.doesNotThrow(() => wrapApply({}, guard)())
  assert.doesNotThrow(() => patchRegistry(null, guard)())
})