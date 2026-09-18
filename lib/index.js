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
// Дальше проверка схемы отвергает всю выжимку сессии.

import z from '@deepseek-ai/schemastery'

import { patchRegistry } from './patch.js'
import { telemetry } from './telemetry.js'
import { registerPluginUpdater } from './updater.js'
import { complaint, damage, healed, usageOf } from './usage.js'

export const name = '@goodandready/dsh-usage-guard'
export const NS = 'dsh-usage-guard'
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
  maxStepTokens: z
    .natural()
    .default(0)
    .description('Maximum allowed token count for a single turn step. Spikes exceeding this ceiling are clamped to prevent integer overflow and runaway stats. Set to 0 to disable.'),
})

export function apply(ctx, config) {
  let live
  try {
    live = Config(structuredClone(config ?? {})) ?? config
  } catch (_) {
    live = Config({}) ?? { repair: true, report: true, maxStepTokens: 0 }
  }

  ctx.inject(['settings'], (sctx) => {
    try {
      const scope = sctx.settings.register(NS, Config, { base: config })
      try {
        const fresh = scope.get()
        if (fresh && typeof fresh === 'object') live = fresh
      } catch (_) {}
      sctx.effect(() => scope.watch((next) => {
        if (next && typeof next === 'object') live = next
      }))
    } catch (_) {}
  })

  // Register one-click updater and telemetry endpoints if webServer is available
  ctx.inject(['webServer'], (wctx) => {
    try {
      wctx.effect(() => registerPluginUpdater(wctx, {
        endpoint: '/api/dsh-usage-guard/update',
        packageName: '@goodandready/dsh-usage-guard',
        manifestUrl: new URL('../package.json', import.meta.url),
      }), 'dsh-usage-guard: plugin updater route')

      wctx.effect(() => wctx.webServer.register({
        kind: 'exact',
        path: '/api/dsh-usage-guard/telemetry',
        handler: async (req, res) => {
          if (req.method === 'GET' || req.method === 'HEAD') {
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            })
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify(telemetry.getSnapshot()))
            return
          }
          res.writeHead(405, { allow: 'GET, HEAD' })
          res.end()
        },
      }), 'dsh-usage-guard: telemetry route')
    } catch (_) {}
  })

  const told = new Set()
  const MAX_TOLD = 1000
  const eventCache = new WeakMap()

  const guard = (event) => {
    if (!event || typeof event !== 'object') return event
    const cached = eventCache.get(event)
    if (cached !== undefined) return cached

    const found = usageOf(event)
    if (!found) {
      eventCache.set(event, event)
      return event
    }
    const bad = damage(found.usage, { maxStepTokens: live?.maxStepTokens })
    if (bad.length === 0) {
      eventCache.set(event, event)
      return event
    }

    const sessionTag = event?.sessionId ?? event?.data?.sessionId ?? event?.data?.turn ?? 'global'
    const seen = `${String(sessionTag)}/${String(found.turn)}/${String(found.step)}/${bad.join(',')}`

    let clampedAny = false
    let fixedTokensCount = 0
    const maxLimit = Number(live?.maxStepTokens) > 0 ? Number(live?.maxStepTokens) : 0
    for (const f of bad) {
      const val = found.usage?.[f]
      if (maxLimit > 0 && typeof val === 'number' && val > maxLimit) {
        clampedAny = true
        fixedTokensCount += (val - maxLimit)
      } else {
        fixedTokensCount += 1
      }
    }

    if (!told.has(seen)) {
      if (told.size >= MAX_TOLD) {
        const oldest = told.values().next().value
        told.delete(oldest)
      }
      told.add(seen)

      telemetry.recordIncident({
        turn: found.turn,
        step: found.step,
        badFields: bad,
        fixedTokenCount: fixedTokensCount,
        clamped: clampedAny,
        provider: event?.provider ?? event?.data?.provider ?? 'unknown',
        sample: found.usage,
      })

      if (live && live.report !== false) {
        try {
          // eslint-disable-next-line no-console
          console.warn(`[dsh-usage-guard] ${complaint(found, bad, { maxStepTokens: live?.maxStepTokens })}`)
        } catch {}
      }
    }

    const result = live && live.repair === false ? event : healed(event, bad, { maxStepTokens: live?.maxStepTokens })
    eventCache.set(event, result)
    return result
  }

  ctx.inject(['sessionProjections'], (pctx) => {
    pctx.effect(
      () => patchRegistry(pctx.sessionProjections, guard),
      'dsh-usage-guard: обезвреживание порций расхода',
    )
  })
}
export { telemetry }
