// dsh-usage-guard — заплатка на счёт токенов.
//
// Харнесс складывает расход в четыре ведра, и два из них берёт без оглядки:
//
//     uncachedInputTokens: usage.inputTokens,        // без подстраховки
//     outputTokens:        usage.outputTokens,       // без подстраховки
//     cacheReadTokens:     usage.cacheReadTokens ?? 0,
//     cacheWriteTokens:    usage.cacheWriteTokens ?? 0,
//
// Стоит провайдеру прислать порцию без первых двух, и сложение даёт NaN.
// Дальше проверка схемы отвергает всю выжимку сессии, а наружу это выходит
// так:
//
//     history unavailable for session "...": expected number, received NaN
//
// Не «счётчик соврал», а «история не открывается вовсе» — и остаётся такой
// навсегда, потому что выжимка считается проигрыванием журнала заново.
//
// Отсюда и лечение. Плагин не переписывает журналы на диске: он встаёт перед
// сложением и подставляет ноль вместо пропажи. Проигрывание идёт через ту же
// точку, поэтому уже испорченные сессии открываются снова — сами, без починки
// файлов.
//
// Ноль вместо пропущенного счётчика — заведомо неправда. Но выбор не между
// точным счётом и приблизительным, а между приблизительным и нечитаемой
// историей.

import z from '@deepseek-ai/schemastery'

import { patchRegistry } from './patch.js'
import { complaint, damage, healed, usageOf } from './usage.js'

export const name = 'dsh-usage-guard'
export const inject = ['sessionProjections']

export const Config = z.object({
  repair: z
    .boolean()
    .default(true)
    .description('Replace a missing or non-numeric token counter with zero before the harness adds it up. '
      + 'Off means reporting only: the counters reach the fold as they came, and a broken sample keeps the '
      + 'session history unreadable.'),
  report: z
    .boolean()
    .default(true)
    .description('Log a line naming the turn, the step and the raw sample whenever a damaged one arrives. '
      + 'Each turn, step and field set is reported once, not once per replay.'),
})

export function apply(ctx, config) {
  let live = Config(structuredClone(config ?? {})) ?? config

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(name, Config, { base: config })
    live = scope.get() ?? live
    sctx.effect(() => scope.watch((next) => { live = next ?? live }))
  })

  // О каждом сочетании сессии, хода, шага и набора полей жалуемся один раз:
  // выжимка считается проигрыванием журнала заново, и без этого одна и та же
  // порция въезжала бы в журнал при каждом открытии истории.
  // Ограничиваем размер (до 1000 записей), чтобы исключить утечку памяти.
  const told = new Set()
  const MAX_TOLD = 1000

  const guard = (event) => {
    const found = usageOf(event)
    if (!found) return event
    const bad = damage(found.usage)
    if (bad.length === 0) return event

    if (live.report !== false) {
      const sessionTag = event?.sessionId ?? event?.data?.sessionId ?? event?.data?.turn ?? 'global'
      const seen = `${String(sessionTag)}/${String(found.turn)}/${String(found.step)}/${bad.join(',')}`
      if (!told.has(seen)) {
        if (told.size >= MAX_TOLD) {
          told.clear()
        }
        told.add(seen)
        try {
          // eslint-disable-next-line no-console
          console.warn(`[dsh-usage-guard] ${complaint(found, bad)}`)
        } catch {
          // Ошибка вывода не должна ломать обработку событий
        }
      }
    }

    return live.repair === false ? event : healed(event, bad)
  }

  ctx.inject(['sessionProjections'], (pctx) => {
    pctx.effect(
      () => patchRegistry(pctx.sessionProjections, guard),
      'dsh-usage-guard: обезвреживание порций расхода',
    )
  })
}