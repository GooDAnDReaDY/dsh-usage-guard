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
      const scope = sctx.settings?.register?.(NS, Config, { base: config })
      if (!scope) {
        const msg = `[dsh-usage-guard] settings service register() unavailable; running with default config`
        if (typeof sctx.logger?.warn === 'function') sctx.logger.warn(msg)
        else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
        return
      }

      if (typeof scope.get === 'function') {
        try {
          const fresh = scope.get()
          if (fresh && typeof fresh === 'object') live = fresh
        } catch (readErr) {
          const msg = `[dsh-usage-guard] failed to read current settings: ${readErr?.message || readErr}; running with initial config`
          if (typeof sctx.logger?.warn === 'function') sctx.logger.warn(msg)
          else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
        }
      } else {
        const msg = `[dsh-usage-guard] settings scope has no get() method; running with default config`
        if (typeof sctx.logger?.warn === 'function') sctx.logger.warn(msg)
        else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
      }

      if (typeof scope.watch === 'function') {
        sctx.effect(() => scope.watch((next) => {
          if (next && typeof next === 'object') live = next
        }))
      } else {
        const msg = `[dsh-usage-guard] settings scope has no watch() method; running with default config without live update subscription`
        if (typeof sctx.logger?.warn === 'function') sctx.logger.warn(msg)
        else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
      }
    } catch (err) {
      const msg = `[dsh-usage-guard] failed to register settings subscription: ${err?.message || err}; running with default config`
      if (typeof sctx.logger?.warn === 'function') sctx.logger.warn(msg)
      else if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(msg)
    }
  })

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
