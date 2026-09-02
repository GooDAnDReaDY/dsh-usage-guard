# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>Session Token-Usage Sanitizer, History Crash Guard & Arithmetic Protection for DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-usage-guard"><img src="https://img.shields.io/npm/v/@goodandready/dsh-usage-guard.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/All_Author_Projects-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="All Author Projects"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ The Root Problem: How Upstream Providers Poison Session History

In **DeepSeek Harness**, session projections aggregate cumulative token usage across four core buckets:

```javascript
uncachedInputTokens: usage.inputTokens,        // No safety fallback in DSH core!
outputTokens:        usage.outputTokens,       // No safety fallback in DSH core!
cacheReadTokens:     usage.cacheReadTokens ?? 0,
cacheWriteTokens:    usage.cacheWriteTokens ?? 0,
```

While DSH core guards `cacheReadTokens` and `cacheWriteTokens` with `?? 0`, it takes `inputTokens` and `outputTokens` **as raw numbers without safety checks**.

When third-party providers, local inference servers, custom proxy gateways, or community routers return non-standard payloads, missing fields, or `NaN`, standard JavaScript arithmetic (`total += NaN`) instantly converts the session's cumulative token sum into `NaN`.

Subsequently, DSH schema validation fatally rejects the entire session digest:
```
history unavailable for session "<session-id>": expected number, received NaN
```

Because session history in DSH is computed dynamically by **replaying the event log**, a single malformed token packet permanently bricks the entire conversation history from being opened ever again.

```mermaid
graph LR
    subgraph Malformed [Upstream Provider Stream]
        API[LLM Output Stream] -->|Returns prompt_tokens / NaN / null| Event[Session Event Chunk]
    end

    subgraph Unprotected [Without dsh-usage-guard]
        Event --> DSHMath[DSH Cumulative Arithmetic]
        DSHMath -->|total += NaN| Poison[🚨 Cumulative Total becomes NaN]
        Poison --> SchemaFail[Schema Validation Rejection]
        SchemaFail --> DeadHistory[💥 Session History Permanently Unreadable]
    end

    subgraph Guarded [With dsh-usage-guard Active]
        Event --> Patch[sessionProjections Interceptor]
        Patch --> AliasCheck{Alias Borrowing Layer}
        AliasCheck -->|Maps prompt_tokens -> inputTokens| Restored[Restored Number]
        AliasCheck -->|If missing / NaN| ZeroFallback[Safe 0 Fallback]
        Restored --> SafeMath[Clean Arithmetic Execution]
        ZeroFallback --> SafeMath
        SafeMath --> ValidHistory[✅ 100% Intact & Recovered Session History]
    end

    style Malformed fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Unprotected fill:#311b1b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
    style Guarded fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## ✨ Key Features & Architectural Defense

### 1. Instant Replay Recovery for Existing Corrupted Sessions
The plugin does **not** alter or rewrite log files on disk. Instead, it hooks the projection fold at runtime. Because session replay passes through this exact interception point, **all previously broken or locked sessions are instantly restored and readable immediately upon installing the plugin**.

### 2. Comprehensive Alias Borrowing Lexicon (`borrowed`)
Before substituting zero, `dsh-usage-guard` scans an extensive dictionary of industry-standard field aliases:

| Target DSH Field | Recognized Vendor Aliases |
|---|---|
| `inputTokens` | `input_tokens`, `input`, `promptTokens`, `prompt_tokens`, `promptTokenCount`, `prompt_eval_count` |
| `outputTokens` | `output_tokens`, `output`, `completionTokens`, `completion_tokens`, `candidatesTokenCount`, `eval_count` |
| `cacheReadTokens` | `cache_read_tokens`, `cachedTokens`, `cached_tokens`, `cache_read_input_tokens`, `cachedContentTokenCount`, `prompt_tokens_details.cached_tokens` |
| `cacheWriteTokens` | `cache_write_tokens`, `cacheCreationTokens`, `cache_creation_input_tokens` |

### 3. Finite Non-Negative Soundness Validation (`sound`)
Strictly validates `typeof value === 'number' && Number.isFinite(value) && value >= 0` to filter out `NaN`, `Infinity`, `null`, `undefined`, negative error codes (e.g. `-1`), and malformed strings before they reach arithmetic operations.

### 4. Safe Zero Fallback (`repaired`)
If a counter cannot be resolved from aliases, it is safely initialized to `0`. The choice is not between exact and approximate numbers, but between approximate token counts and an unreadable dead session.

### 5. In-Memory Registry Monkey-Patching (`lib/patch.js`)
* **Pre-existing Projections**: Wraps all `.apply` methods currently registered in `sessionProjections.registrations` while preserving full `this` context.
* **Late-Binding Projections**: Traps future projection registrations via `map.set` wrapping, guaranteeing 100% coverage regardless of plugin loading order.
* **Universal Projection Protection**: Protects not only token counters, but also context pressure calculators and busy-state analyzers.
* **Zero Performance Overhead**: Uses shallow event cloning only along the usage path; all other event data references remain untouched.

### 6. Deduplicated Diagnostic Reporting (`told`)
Logs informative diagnostic warnings naming the exact session, turn, step, raw payload, and recovery action (e.g. `inputTokens borrowed from alias` vs `inputTokens zeroed`). Incidents are deduplicated in memory so logs are not flooded during replays, and the cache is capped at 1,000 items to prevent memory leaks.

---

## 🚀 Changed in v0.1.1

* **Negative Number Protection (`nonnegative`)**:
  In v0.1.0, negative counters like `-1` (sometimes returned by proxy gateways during rate limits or faults) passed finite-number checks and crashed DSH schema validation (`z.number().int().nonnegative()`). In v0.1.1, `sound()` strictly requires `value >= 0`. Any negative number is treated as corrupted and safely zeroed out.
* **Safe Coercion of Stringified Numbers**:
  If an upstream provider delivers valid token counts formatted as strings (e.g. `inputTokens: "1540"`), v0.1.1 coerces them into true numbers rather than resetting them to zero.
* **Expanded Ecosystem Aliases**:
  - **Google Gemini API**: added `promptTokenCount`, `candidatesTokenCount`, and `cachedContentTokenCount`.
  - **Ollama native API**: added `prompt_eval_count` and `eval_count`.
  - **OpenAI prompt caching**: added nested resolution of `prompt_tokens_details.cached_tokens`.
* **Preservation of `this` Context in Projections**:
  In `lib/patch.js`, `wrapApply` now dispatches via `original.call(this, state, guard(event))`, ensuring complete compatibility with class-based projection handlers.
* **Crash-Proof Diagnostic Logging**:
  In `complaint()`, object serialization is now safely protected with `try...catch` against circular structures and `BigInt` values.
* **Session-Aware Deduplication & Memory Bound**:
  Warning deduplication now incorporates `sessionId` to avoid cross-session warning suppression. `told` cache size is bounded to 1,000 entries to prevent memory growth in long-running processes.

---

## 📦 Quick Installation

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

> [!IMPORTANT]
> Restart DSH Web UI after installation (`systemctl --user restart dsh-web`) to activate protection and instantly revive any previously locked sessions.

---

## ⚙️ Configuration Reference (`settings.yaml`)

```yaml
dsh-usage-guard:
  repair: true
  report: true
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `repair` | `boolean` | `true` | Replace missing or non-numeric token counters with zero before arithmetic accumulation |
| `report` | `boolean` | `true` | Log diagnostic warning lines naming turn, step, and raw sample when damaged metrics arrive |

---

## 📄 License

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)