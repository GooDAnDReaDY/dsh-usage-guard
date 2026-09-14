# Task Plan: Feature Expansion, Locale Canonization, One-Click Updater, and Telemetry (#9)

## Goal
Advance @goodandready/dsh-usage-guard to a full-featured, production-standard DSH plugin adhering strictly to DSH Plugin Authoring, Documentation Standard, and Project Design Contract:
1. Canonical multi-language support (en & zh locales in plugin; zero hardcoded ru; register translation issue in dsh-russian-lang).
2. Host-side one-click updater (/api/dsh-usage-guard/update) following references/plugin-updater.ts with UI card integration.
3. In-memory anomaly counters & telemetry: live tracking of rescued events, fixed NaN tokens, and provider anomaly events exposed via web server / state to the settings UI.
4. Token anomaly clamping & validation: configurable maxStepTokens limit to prevent runaways and negative spikes.
5. Design contract and documentation sync (docs/design/DESIGN.md, READMEs).
6. Comprehensive unit and integration testing without external dependencies (50/50 tests passing).

## Current Phase
Phase 5: Verification, Documentation & Design Contract Complete

## Phases

### Phase 1: Locale Canonization & dsh-russian-lang Registration
- [x] Remove hardcoded ru dictionary from lib/client.js
- [x] Add comprehensive zh (Simplified Chinese) translations matching en dictionary
- [x] Register Gitea issue in goodandready/dsh-russian-lang detailing all locale keys, en text, zh text, and expected ru meaning (Issue #196)
- [x] Update client tests for en/zh locale fallback and verify zero Cyrillic in client.js
- Status: complete

### Phase 2: Host-Side One-Click Plugin Updater & Server Telemetry Endpoint
- [x] Implement lib/updater.js based on canonical plugin-updater.ts (GET status, POST installExact with same-origin / loopback check)
- [x] Implement lib/telemetry.js for tracking rescue events and token anomalies
- [x] Wire updater and telemetry into lib/index.js webServer routes
- [x] Add unit tests for updater endpoint logic and telemetry accumulation (test/updater.test.mjs, test/telemetry.test.mjs)
- Status: complete

### Phase 3: Token Clamping & Anomaly Sanitizer Enhancements
- [x] Extend Config schema with maxStepTokens (optional ceiling, default 0/disabled, 1,000,000 in UI draft)
- [x] Enhance lib/usage.js to clamp absurd spikes and filter negative tokens safely
- [x] Add unit tests for clamping and anomaly logging in test/usage.test.mjs
- Status: complete

### Phase 4: UI Refinement in lib/client.js (Telemetry Grid & Updater Card)
- [x] Integrate Live Telemetry Box into Settings Card (Rescued Events, Fixed Tokens, Clamped Spikes, Last Incident)
- [x] Integrate Version / Update Section into Settings Card (Current, Latest, Update button, status toasts)
- [x] Align with native DSH CSS design tokens and dsh-clinebot design system
- [x] Verify ErrorBoundary, idempotent CSS, and slot registration
- Status: complete

### Phase 5: Verification, Documentation & Design Contract
- [x] Run full test suite with node --test test/*.test.mjs (50/50 passing)
- [x] Update docs/design/DESIGN.md with new components, telemetry, and updater decisions
- [x] Update README.md, README.zh.md, README.ru.md
- [x] Verify npm pack compliance and file sizes (< 256 KiB)
- Status: complete
