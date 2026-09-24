# Changelog

Notable changes to `@goodandready/dsh-usage-guard`.

## 0.1.15

### Fixed
- Resolved symlinks in `findDshCliEntry` via `realpathSync` so symlinked global `dsh` CLI binaries reliably locate `@deepseek-ai/dsh/lib/bin.js` for automatic updates (#37).
- Unified `/api/dsh-usage-guard/telemetry` route registration via `registerTelemetryRoute` and eliminated duplicate inline handler (#38).
- Avoided V8 array deoptimization in `damage()` by preserving `bad` as a pure packed array, storing clamping metadata in a module WeakMap (#39).
- Prioritized canonical property check in `borrowed()` before iterating alias synonyms (#40).
- Updated design contract documentation for `plugins.item` primary slot, fallbacks, and theme CSS variables (#41).

## 0.1.14

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#42).

## 0.1.13

### Fixed
- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item`. The view-aware card is now registered there
  (`id: 'dsh-usage-guard'`, order 60, static label); the row seat and the legacy
  `settings.plugin.item` card stay as fallbacks. The client test now expects the three
  seats in order.

## 0.1.12

### Fixed
- **Settings reachable again**: the card registered into `settings.plugin.item`, a
  slot the current DSH core (0.1.6-alpha.2) no longer renders, so the plugin's
  settings were unreachable. The surface now registers into the Plugins page row
  seat `plugins.row.config`, keyed
  `@goodandready/dsh-usage-guard#dsh-usage-guard`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, without our card chrome and header —
  the host page draws the title, icon, crumb and padding) plus a one-line state for
  `view: 'summary'`. The legacy seat stays registered as a fallback for older cores.

### Changed
- `test/client.test.mjs` now expects both seats in order (row seat first, legacy
  seat second) and checks the row key and locale of each.
