# Changelog

Notable changes to `@goodandready/dsh-usage-guard`.

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
