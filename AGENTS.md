# AGENTS.md — @goodandready/dsh-usage-guard

Project-specific rules. The shared workflow stays in the DEV root `/mnt/external/Project/DEV/AGENTS.md`.

## Identity
- Package name: `@goodandready/dsh-usage-guard` (must match `package.json`, `cordis.patch.yml` `name:`, client `id: '@goodandready/dsh-usage-guard'`, and server `export const name = '@goodandready/dsh-usage-guard'`).
- Gitea: `goodandready/dsh-usage-guard` (canonical upstream).
- Public mirror: `GooDAnDReaDY/dsh-usage-guard` on GitHub.
- Agent git wrapper: `/home/vadim/.ssh/bin/git-antigravity`; never bare `git` for commit/push.

## Layout & Worktrees
- Root checkout is read-only. All modifications happen strictly in `.worktrees/<branch>`.
- Client bundle: `lib/client.js` is self-contained and loaded via DSH `window.__ModuleLoader__.load()`.
- Server entry: `lib/index.js` (plugin lifecycle `apply()`, Cordis service injections, schema, and webServer routes).

## Threat Model & Constraints
- **Sanitizer & Rescuer, NOT a spend enforcer**:
  - The plugin repairs missing, non-numeric, or corrupted token counters (`NaN`, negative numbers, unparseable strings) by safely resetting them to 0 or borrowing from known provider synonyms before Cordis/DSH arithmetic fold.
  - Spike suppression: when `maxStepTokens > 0`, counter values exceeding the threshold are clamped to prevent runaway session histories.
  - If `repair: false` or `maxStepTokens: 0`, raw counters pass through as received. The plugin does NOT block turns or enforce spend budgets.
- **Fail-closed route policy**:
  - Updater (`/api/dsh-usage-guard/update`) and telemetry (`/api/dsh-usage-guard/telemetry`) routes strictly validate caller origin via `isTrustedUpdateRequest` and `isTrustedSettingsRequest`.
  - Unconditionally reject cross-site and same-site requests with HTTP 403 Forbidden.
  - Non-HTTP referer schemes on loopback (e.g. `dsh-app://app/` from DSH Desktop Electron) are permitted to fall through to loopback socket verification (#55).
- **Supply-Chain Release Age Compliance**:
  - The in-app updater strictly adheres to profile policies (`minimumReleaseAge` in `pnpm-workspace.yaml`). Do not pass `--config.minimumReleaseAge=0` (#58).
- **Code cleanliness**:
  - Zero empty catch blocks.
  - No wildcard CORS headers.

## Settings & Schema
- Managed via DSH Settings service and `Config` schema in `lib/index.js`.
- All fields (`repair`, `report`, `maxStepTokens`) are declared `.volatile()` for reactive DSH 0.2 Settings Form support (#48).
- Reactive configuration updates are unwrapped via `plainConfig()` on `loader/volatile-update` events (#49).

## Commands
```bash
npm test                 # Run all 66 unit & integration tests across 7 suites
npm audit --omit=dev     # Verify 0 production vulnerabilities (using package-lock.json)
bash /home/vadim/.dsh/skills/dsh-plugin-preflight/scripts/preflight.sh .  # Preflight check
```

## Publication Safety (MUST NOT)
- `AGENTS.md`, `index.md`, `docs/**`, and `scripts/**` are internal engineering documents and MUST NEVER be published to npm or mirrored to public GitHub.
- Exclusion is guaranteed by `package.json` `files` allowlist, `.gitattributes export-ignore`, and `scripts/publish-github.sh` FORBIDDEN filter.
- Never use force flags (`--force`, `git push -f`, `npm publish --force`).
