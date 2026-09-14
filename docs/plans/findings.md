# Findings: Feature Expansion (#9)

## Key Technical Discoveries
1. **Locale Policy**: DSH Plugin Authoring standard strictly forbids embedding hardcoded Russian dictionaries directly in plugin bundles. English is canonical; Chinese (`zh`) is mandatory; Russian localization is strictly handled by registering a translation issue in `goodandready/dsh-russian-lang` on Gitea (Issue #196 registered with 36 locale keys).
2. **One-Click Updater Security**: The canonical DSH updater specification requires loopback remoteAddress verification, `sec-fetch-site: same-origin`, matching `host` and `origin` headers, and a dedicated `x-dsh-plugin-update: 1` header to prevent SSRF and CSRF exploits.
3. **Telemetry In-Memory Design**: A lightweight in-memory circular buffer (FIFO, capped at 20 entries) combined with cumulative counters (`rescuedEvents`, `fixedTokens`, `clampedSpikes`) provides zero-overhead observability without requiring a database or external dependencies.
4. **Token Spike Clamping**: Certain proxy services (e.g. ill-configured OpenRouter relays or local Ollama runners) occasionally emit runaway or corrupted token numbers exceeding 2,000,000+. Clamping them at a configurable threshold (`maxStepTokens`) preserves session summaries from integer overflow and chart distortion.
5. **CSS Token Purity**: DSH theme variables (`--dsw-alias-*`) should not include hardcoded hex fallbacks inside `var()`, as they interfere with theme switching and contrast rules.
