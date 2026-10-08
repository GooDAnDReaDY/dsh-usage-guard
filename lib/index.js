// dsh-usage-guard — Token usage counter sanitizer and session history protector.
//
// DSH core aggregates token usage into four buckets, two of which are accessed without fallbacks:
//
//     uncachedInputTokens: usage.inputTokens,        // unguarded
//     outputTokens:        usage.outputTokens,       // unguarded
//     cacheReadTokens:     usage.cacheReadTokens ?? 0,
//     cacheWriteTokens:    usage.cacheWriteTokens ?? 0,
//
// If a provider returns a usage sample missing either of the first two, accumulation yields NaN.
// Subsequent schema validation then rejects the entire session history projection.

import z from '@deepseek-ai/schemastery'

import { patchRegistry } from './patch.js'
import { telemetry, registerTelemetryRoute } from './telemetry.js'
import { registerPluginUpdater } from './updater.js'
import { complaint, damage, healed, usageOf } from './usage.js'

export const name = '@goodandready/dsh-usage-guard'
export const NS = 'dsh-usage-guard'
export const inject = ['sessionProjections']

export const Config = z.object({
  repair: z
    .boolean()
    .default(true)
    .volatile()
    .description('Replace a missing or non-numeric token counter with zero before the harness adds it up. '
      + 'Off means reporting only: the counters reach the fold as they came, and a broken sample keeps the '
      + 'session history unreadable.'),
  report: z
    .boolean()
    .default(true)
    .volatile()
    .description('Log a line naming the turn, the step and the raw sample whenever a damaged one arrives. '
      + 'Each turn, step and field set is reported once, not once per replay.'),
  maxStepTokens: z
    .natural()
    .default(0)
    .volatile()
    .description('Maximum allowed token count for a single turn step. Spikes exceeding this ceiling are clamped to prevent integer overflow and runaway stats. Set to 0 to disable.'),
})

export function plainConfig(val) {
  if (!val || typeof val !== 'object') return val
  if (typeof val.get === 'function') return plainConfig(val.get())
  const out = Array.isArray(val) ? [] : {}
  for (const [k, v] of Object.entries(val)) out[k] = plainConfig(v)
  return out
}

export function apply(ctx, config) {
  let live
  try {
    const plain = plainConfig(config ?? {})
    live = plainConfig(Config(plain)) ?? plain
  } catch (_) {
    live = Config({}) ?? { repair: true, report: true, maxStepTokens: 0 }
  }

  let settingsSvc = null
  const readLive = () => {
    try {
      const row = settingsSvc?.describe?.()?.find?.((r) => r?.ns === NS)
      if (row?.value) {
        return plainConfig(Config(plainConfig(row.value)))
      }
    } catch (describeErr) {
      if (typeof ctx.logger?.debug === 'function') {
        ctx.logger.debug('[dsh-usage-guard] failed to read settings via describe():', describeErr)
      }
    }
    try {
      return plainConfig(Config(plainConfig(config)))
    } catch (configErr) {
      if (typeof ctx.logger?.debug === 'function') {
        ctx.logger.debug('[dsh-usage-guard] failed to derive config from base:', configErr)
      }
      return live
    }
  }

  ctx.inject(['settings'], (sctx) => {
    settingsSvc = sctx.settings ?? (typeof sctx.get === 'function' ? sctx.get('settings') : null) ?? null
    const fresh = readLive()
    if (fresh) live = fresh
  })

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      const onVolatileUpdate = () => {
        const fresh = readLive()
        if (fresh) live = fresh
      }
      ctx.on?.('loader/volatile-update', onVolatileUpdate)
      ctx.on?.('settings/document-updated', onVolatileUpdate)
      return () => {
        ctx.off?.('loader/volatile-update', onVolatileUpdate)
        ctx.off?.('settings/document-updated', onVolatileUpdate)
      }
    }, 'dsh-usage-guard: volatile-update')
  }

  // Register one-click updater and telemetry endpoints if webServer is available
  ctx.inject(['webServer'], (wctx) => {
    try {
      wctx.effect(() => registerPluginUpdater(wctx, {
        endpoint: '/api/dsh-usage-guard/update',
        packageName: '@goodandready/dsh-usage-guard',
        manifestUrl: new URL('../package.json', import.meta.url),
      }), 'dsh-usage-guard: plugin updater route')

      wctx.effect(() => registerTelemetryRoute(wctx, {
        endpoint: '/api/dsh-usage-guard/telemetry',
      }), 'dsh-usage-guard: telemetry route')
    } catch (err) {
      const msg = `[dsh-usage-guard] failed to register routes on webServer: ${err?.message || err}`
      if (typeof wctx.logger?.warn === 'function') wctx.logger.warn(msg)
      else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
    }
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
      })

      if (live && live.report !== false) {
        const msg = `[dsh-usage-guard] ${complaint(found, bad, { maxStepTokens: live?.maxStepTokens })}`
        if (typeof ctx.logger?.warn === 'function') {
          ctx.logger.warn(msg)
        } else {
          // eslint-disable-next-line no-console
          console.warn(msg)
        }
      }
    }

    const result = live && live.repair === false ? event : healed(event, bad, { maxStepTokens: live?.maxStepTokens })
    eventCache.set(event, result)
    return result
  }

  ctx.inject(['sessionProjections'], (pctx) => {
    pctx.effect(
      () => patchRegistry(pctx.sessionProjections, guard),
      'dsh-usage-guard: sanitize usage counter samples',
    )
  })
}
export { telemetry }
