# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>Session Token-Usage Sanitizer, History Crash Guard & Arithmetic Protection for DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-usage-guard"><img src="https://img.shields.io/npm/v/@goodandready/dsh-usage-guard.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GooDAnDReaDY/dsh-usage-guard.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ The Problem: How Upstream Providers Poison Session History

In **DeepSeek Harness**, session projections aggregate cumulative token usage across four core buckets:
* `inputTokens`
* `outputTokens`
* `cacheReadTokens`
* `cacheWriteTokens`

The core harness assumes that upstream providers will always return valid finite numbers for `inputTokens` and `outputTokens`. 

However, non-standard upstream providers, local inference engines (vLLM, Ollama), third-party gateways, and community routers frequently emit malformed usage objects:
* **Alternative field names**: `prompt_tokens`, `promptTokens`, `input`, `completion_tokens`, `output`, `cached_tokens`;
* **Missing or null fields**: `undefined`, `null`;
* **Non-finite numbers**: `NaN`, `Infinity`, or string numbers.

When standard DSH performs accumulation (`total += usage.inputTokens`), adding `NaN` or `undefined` instantly poisons the cumulative total into `NaN`. Once written to disk, **the entire conversation session becomes unreadable and crashes the Web UI upon reload**.

```mermaid
graph LR
    subgraph Malformed [Upstream Provider Stream]
        API[LLM Output Stream] -->|Emits prompt_tokens / NaN / null| Event[Session Event]
    end

    subgraph Unprotected [Without dsh-usage-guard]
        Event --> DSHMath[DSH Cumulative Arithmetic]
        DSHMath -->|total += NaN| Poison[🚨 Cumulative Usage becomes NaN]
        Poison --> DiskDead[Corrupted Session File on Disk]
        DiskDead --> Crash[💥 Web UI Crashes on Reload]
    end

    subgraph Guarded [With dsh-usage-guard Active]
        Event --> Interceptor[sessionProjections Registry Patch]
        Interceptor --> AliasCheck{Alias Borrowing Layer}
        AliasCheck -->|Maps prompt_tokens -> inputTokens| Restored[Restored Number]
        AliasCheck -->|If missing / invalid| Zero[Safe 0 Fallback]
        Restored --> SafeMath[Clean Arithmetic Execution]
        Zero --> SafeMath
        SafeMath --> SafeDisk[✅ 100% Intact Session History]
    end

    style Malformed fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Unprotected fill:#311b1b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
    style Guarded fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## 🛡️ Multi-Tier Healing Architecture

`dsh-usage-guard` intercepts `sessionProjections` events before cumulative addition and repairs usage payloads non-destructively:

### 1. Alias Borrowing (`borrowed`)
Before defaulting to zero, the guard searches common provider alias dictionaries:
* **`inputTokens`** ← `prompt_tokens`, `promptTokens`, `input`
* **`outputTokens`** ← `completion_tokens`, `completionTokens`, `output`
* **`cacheReadTokens`** ← `cache_read_tokens`, `cachedTokens`, `cached_tokens`, `cache_read_input_tokens`
* **`cacheWriteTokens`** ← `cache_write_tokens`, `cacheCreationTokens`, `cache_creation_input_tokens`

### 2. Finite Number Validation (`sound`)
Verifies `typeof value === 'number' && Number.isFinite(value)` to reject `NaN`, `Infinity`, and malformed strings.

### 3. Safe Zero Fallback (`repaired`)
If a required metric cannot be recovered via aliases, it is safely initialized to `0`. While an approximate metric, it completely prevents arithmetic poisoning and guarantees session durability.

### 4. Diagnostic Logging (`complaint`)
When a damaged usage object is sanitized, the plugin logs the exact turn, step, original payload, and whether fields were mapped via aliases or zeroed.

---

## 🔌 In-Memory Projection Hook (`lib/patch.js`)

The plugin patches the `sessionProjections` registry in-memory:
* **Pre-existing Projections**: Wraps all existing `.apply` projection handlers currently active in the service.
* **Late-Binding Projections**: Traps future projection registrations via `map.set` wrapping, ensuring 100% coverage regardless of plugin load order.
* **Zero Overhead**: Uses shallow event cloning only along the usage path, preserving all other event references intact.

---

## 📦 Quick Installation

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

> [!IMPORTANT]
> Restart DSH after installation (`systemctl --user restart dsh-web`) to activate projection protection.

---

## 📄 License

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
