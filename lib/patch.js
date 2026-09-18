// How the patch intercepts before state reduction.
//
// The session projection registry is a service with an exposed registrations map. Each entry
// holds a sanitized copy of what the owner registered, and calls `apply` on that copy.
// Therefore, we patch the definition's apply method, not the original object passed at registration.
//
// Load order is not guaranteed, and in practice core projections may register later than our plugin.
// Patching the service's `register` method is ineffective because callers go through an intermediary.
// Hence, we hook into the registrations map itself — a standard Map instance shared by all participants.
//
// All projections are wrapped, not just a single one. Token usage is consumed by multiple systems:
// context pressure calculations, session token sums, and analytics. Each would fail on a missing
// counter. Wrapping all projections with a guard that returns the exact object reference for healthy
// events costs only a single reference comparison for events without usage.

/** Marker on patched functions to prevent double wrapping. */
export const PATCHED = Symbol.for('dsh-usage-guard.patched')

/**
 * Wrap the apply method of a registry definition, preserving `this` context.
 *
 * @param def - Projection definition entry.
 * @param guard - Event sanitizer function.
 * @returns Cleanup function restoring the original method.
 */
export function wrapApply(def, guard) {
  if (!def || typeof def.apply !== 'function' || def.apply[PATCHED]) return () => {}
  const original = def.apply
  const patched = function (state, event) {
    return original.call(this, state, guard(event))
  }
  patched[PATCHED] = true
  def.apply = patched
  return () => {
    if (def.apply === patched) def.apply = original
  }
}

/**
 * Patch the session projections registry.
 *
 * @param registry - `sessionProjections` service instance.
 * @param guard - Event sanitizer function; receives an event and returns either the same event or a repaired copy.
 * @returns Teardown function that removes all installed hooks in reverse order.
 */
export function patchRegistry(registry, guard) {
  const undo = []
  const map = registry && typeof registry === 'object' ? registry.registrations : undefined
  if (!map || typeof map.set !== 'function' || typeof map.values !== 'function') return () => {}

  // Wrap entries already registered before this patch
  for (const entry of map.values()) {
    if (entry && entry.def) undo.push(wrapApply(entry.def, guard))
  }

  // Intercept entries registered in the future when inserted into the map
  const originalSet = map.set
  if (!originalSet[PATCHED]) {
    const patched = function (key, value) {
      if (value && value.def) undo.push(wrapApply(value.def, guard))
      return originalSet.call(this, key, value)
    }
    patched[PATCHED] = true
    map.set = patched
    undo.push(() => {
      if (map.set === patched) map.set = originalSet
    })
  }

  return () => {
    for (const step of undo.reverse()) step()
    undo.length = 0
  }
}
