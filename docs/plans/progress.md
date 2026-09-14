# Progress: Feature Expansion (#9)

- Created Gitea Issue #9 ([epic] Расширение функционала, канонизация локалей (en/zh), one-click updater и телеметрия перехватов).
- Set up isolated worktree `.worktrees/feat-expansion-and-updater` on branch `feat/feature-expansion-and-updater` from `origin/main`.
- Initialized planning-with-files structure in `docs/plans/task_plan.md`, `findings.md`, `progress.md`.
- Posted start comment to Issue #9.
- Registered Gitea Issue #196 in `goodandready/dsh-russian-lang` with complete 36-key bilingual mapping (en, zh, expected ru context).
- Implemented `lib/telemetry.js` with accumulator, FIFO incident ring buffer, and `GET /api/dsh-usage-guard/telemetry`.
- Implemented `lib/updater.js` with canonical DSH updater pattern and security checks (`isTrustedUpdateRequest`).
- Updated `lib/usage.js` with `maxStepTokens` clamping support in `damage()`, `repaired()`, `healed()`, and `complaint()`.
- Updated `lib/index.js` adding `maxStepTokens` to `Config`, mounting updater and telemetry endpoints, and connecting telemetry recording.
- Re-architected `lib/client.js` with canonical `en` and `zh` dictionaries (zero hardcoded Russian), Live Telemetry grid, maxStepTokens number control, and One-Click Updater widget.
- Added comprehensive unit tests: `test/telemetry.test.mjs`, `test/updater.test.mjs`, extended `test/usage.test.mjs` and `test/client.test.mjs`.
- Full test pass: 50/50 tests passing with zero failures.
- Updated `docs/design/DESIGN.md`, `README.md`, `README.ru.md`, and `README.zh.md`.
