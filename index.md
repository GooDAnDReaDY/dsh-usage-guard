# dsh-usage-guard

Current release line: **0.1.x** (token counter sanitizer, NaN arithmetic guard, session history rescuer, and reactive telemetry).

## Purpose
Prevents corrupted token-usage samples from breaking session histories in DeepSeek Harness (DSH):
- **NaN arithmetic poisoning guard**: intercepts session projection events before the fold and substitutes 0 for missing/corrupted counters, preventing `expected number, received NaN` deserialization crashes.
- **Ecosystem alias borrowing**: extracts equivalent counters from vendor-specific fields (Google Gemini `promptTokenCount`, Ollama `prompt_eval_count`, OpenAI `prompt_tokens_details.cached_tokens`).
- **Spike clamping**: suppresses runaway anomalous token spikes when `maxStepTokens` is configured.
- **Reactive configuration**: instant live config reload via `loader/volatile-update` and `.volatile()` Schemastery fields without harness restart.
- **Live telemetry & settings UI**: native DSH card (`plugins.item`, `plugins.row.config`) with incident telemetry and one-click in-app updater.

## Status
- Package: `@goodandready/dsh-usage-guard`
- Version: see `package.json`
- Tests: `npm test` (66/66 passing, 0 failures across 7 test suites)
- Audit: `npm audit --omit=dev` (0 vulnerabilities)
- Runtime: Node >= 20, DSH >= 0.1.6 / 0.2.x

## Paths & Remotes
- DEV root: `/mnt/external/Project/DEV/dhsplugins/dsh-usage-guard`
- Worktrees: `.worktrees/<branch>` only; DEV root checkout is read-only
- Gitea: `goodandready/dsh-usage-guard` (canonical development repository)
- GitHub: `GooDAnDReaDY/dsh-usage-guard` (sanitized public product mirror only)
- Production profile: `/home/vadim/.dsh/profiles/web` (`dsh-web.service` on MiniAI `192.168.1.111`)

## Entry Points
- Server entry: `lib/index.js` (plugin `apply`, settings schema, route registration)
- Client bundle: `lib/client.js` (browser bundle for DSH `window.__ModuleLoader__.load()`)
- Bundle patch: `cordis.patch.yml`

## Modules
- `lib/index.js` — Plugin lifecycle, Cordis service injection, live config management, route registration
- `lib/patch.js` — Session projection registry interception (`wrapApply`, `patchRegistry`)
- `lib/usage.js` — Core token counter sanitization, alias borrowing, spike clamping, and complaint logging
- `lib/telemetry.js` — Incident ring buffer (20 items), caller verification (`isTrustedSettingsRequest`), route `/api/dsh-usage-guard/telemetry`
- `lib/updater.js` — One-click updater (`isTrustedUpdateRequest`, `buildInstallArgs`), route `/api/dsh-usage-guard/update`
- `lib/client.js` — Web UI bundle: settings card, status badges, live telemetry dashboard, one-click update

## Verified Commands
```bash
npm test                 # Run automated test suites (node --test test/*.test.mjs)
npm audit --omit=dev     # Audit production dependencies
npm pack --dry-run       # Verify package manifest contents (exactly 12 files)
bash /home/vadim/.dsh/skills/dsh-plugin-preflight/scripts/preflight.sh . # Mechanical release audit
```

## Test Matrix (66 tests across 7 test suites)
| Suite | File | Tests | Coverage Scope |
| :--- | :--- | :---: | :--- |
| **Client UI** | `test/client.test.mjs` | 8 | Seat registrations (`plugins.item`), CSS injection, error boundary, no raw hex/rgb, 15s fetch timeout (#52) |
| **Config Lifecycle** | `test/config.test.mjs` | 8 | Schemastery `.natural()`, absence of obsolete `settings.register` (#50), reactive `loader/volatile-update` (#49), `.volatile()` (#48), DSH 0.2 DoD (#47) |
| **Package Identity** | `test/identity.test.mjs` | 2 | Package name 4-way match (`@goodandready/dsh-usage-guard`), no lingering `.tgz` tarballs (#19) |
| **Registry Patch** | `test/patch.test.mjs` | 9 | Interception before/after registration, `wrapApply` this context, unpatching, WeakMap caching |
| **Telemetry & Security**| `test/telemetry.test.mjs` | 4 | Incident ring buffer (20 max), caller verification (`isTrustedSettingsRequest`), 403/200 route checks, DSH Desktop loopback referer (#55) |
| **Plugin Updater** | `test/updater.test.mjs` | 4 | `isTrustedUpdateRequest`, route registration, `findDshCliEntry` symlink resolution (#37), no `minimumReleaseAge=0` override (#58) |
| **Usage Sanitizer** | `test/usage.test.mjs` | 31 | NaN prevention, chunk/turn usage extraction, Google/Ollama/OpenAI alias borrowing, spike clamping, float rounding, string coercion |
| **Total** | **7 test files** | **66** | **All passing (0 failures)** |

## Publication & Deployment
- Publication allowlist: `lib/`, `cordis.patch.yml`, `README.md`, `README.ru.md`, `README.zh.md`, `LICENSE`, `package.json`, `CHANGELOG.md`
- Internal only: `AGENTS.md`, `index.md`, `docs/**`, `scripts/**`, `test/**` (enforced via `.gitattributes export-ignore` and `scripts/publish-github.sh`)
- Production rollout: installed in `/home/vadim/.dsh/profiles/web` via `pnpm add @goodandready/dsh-usage-guard@<version> --save-exact` followed by `systemctl restart dsh-web.service`
