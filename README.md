# 📦 @goodandready/dsh-usage-guard

<div align="center">

[![npm version](https://img.shields.io/npm/v/@goodandready/dsh-usage-guard.svg?style=flat-square)](https://www.npmjs.com/package/@goodandready/dsh-usage-guard)
[![license](https://img.shields.io/github/license/GooDAnDReaDY/dsh-usage-guard.svg?style=flat-square)](LICENSE)
[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-6366f1.svg?style=flat-square)](https://github.com/topics/dsh-plugin)

**[ 🇬🇧 English ](#-english) • [ 🇷🇺 Русский ](#-русский) • [ 🇨🇳 中文 ](#-中文)**

</div>

---

<a name="-english"></a>
## 🇬🇧 English

# dsh-usage-guard

A one-purpose patch for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh):
**one malformed token-usage sample should not take a whole session history down with it.**

## The failure

Open a session and get this instead of your conversation:

```
history unavailable for session "session-…":
  { "expected": "number", "code": "invalid_type", "received": "NaN",
    "path": [ "uncachedInputTokens" ],
    "message": "Invalid input: expected number, received NaN" }
```

Not a wrong number in a counter — no history at all. And it stays that way,
because the session summary is recomputed by replaying the log every time.

## The cause

The harness folds provider-reported usage into four buckets, and guards two of
the four:

```js
const bucketsFrom = (usage) => ({
  uncachedInputTokens: usage.inputTokens,          // unguarded
  outputTokens:        usage.outputTokens,         // unguarded
  cacheReadTokens:     usage.cacheReadTokens ?? 0, // guarded
  cacheWriteTokens:    usage.cacheWriteTokens ?? 0,// guarded
})
```

Cache fields are optional because plenty of providers never send them. The two
that are not guarded are just as optional in practice: providers disagree about
the shape of a usage report, and some send only part of it. One sample without
`inputTokens` turns the running total into `NaN`, the schema refuses it, and the
whole history goes with it.

## What this plugin does

It steps in front of the fold. A counter that is missing, `null`, `NaN` or not a
number at all is repaired before the harness adds it up.

Zero is the last resort, not the first move. Providers disagree about what to
call the same number — `inputTokens`, `input_tokens`, `input`, `promptTokens` —
and the harness knows one spelling, so the rest read as absent even though the
figure is sitting right there. The plugin looks under the usual other names
first and only falls back to zero when there is genuinely nothing to take.

Because the fold is also where replay goes, **sessions that are already broken
open again by themselves** — no session file is rewritten, nothing on disk is
touched, and removing the plugin puts everything back exactly as it was.

Zero in place of a missing counter is a known lie. But the choice is not between
an exact total and an approximate one — it is between an approximate total and a
conversation you cannot read.

It also names the culprit. Each damaged sample is reported once, with the turn,
the step and the raw object as it arrived:

```
[dsh-usage-guard] usage sample out of shape — turn 1, step 1;
    arrived as: {"outputTokens":14,"cacheReadTokens":1024}; inputTokens zeroed
[dsh-usage-guard] usage sample out of shape — turn 3, step 1;
    arrived as: {"input":22533,"output":20}; inputTokens taken from an alias; outputTokens taken from an alias
```

That line is the point of the reporting half: providers that send incomplete
usage are worth knowing about, and a bare `NaN` never told you which one it was.

## Install

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

Restart the harness afterwards. There is no UI and nothing to configure to get
the fix — it works from the moment it loads.

## Settings

In `$DSH_HOME/settings.yaml` under `dsh-usage-guard:`, or in the profile:

| Field | Default | Description |
|---|---|---|
| `repair` | `true` | Replace a missing or non-numeric counter with zero before the fold. Off means reporting only — the fold sees the sample as it came, and a broken one keeps the history unreadable. |
| `report` | `true` | Log the turn, the step and the raw sample when a damaged one arrives. Reported once per turn, step and field set, not once per replay. |

Turning `repair` off is for one situation: you want to see the failure happen
rather than have it papered over.

## How it attaches

Session projections live in an ordinary registry service, keyed by name, and
each entry holds the `apply` the harness actually calls. The plugin wraps those.

It wraps **all** of them, not one. Usage is read in three separate places —
`tokenUsage` folds the four buckets, `contextPressure` computes its own sum for
the prompt size, `contextBreakdown` its own for occupancy — and every one of
them trips over the same missing counter. Keeping a list of keys in step with
someone else's code is a standing debt; the guard is an identity for an event
that carries no damaged usage, so a projection that never looks at usage pays
one comparison and gets the very same event object it would have got anyway.

Load order does not matter: whatever is already registered is wrapped
immediately, and whatever registers later is caught as it lands in the registry.

Nothing is patched by editing files, so a harness upgrade replaces the code this
plugin wraps rather than fighting with it. If a later version guards those two
fields itself, this plugin becomes a no-op that only reports — and can be
removed.

## Structure

```
dsh-usage-guard/
├── package.json         # dsh bundle metadata + peerDependencies
├── cordis.patch.yml     # bundle layer: inserts the plugin row
├── lib/index.js         # the plugin: settings, reporting, attachment
├── lib/usage.js         # what counts as damaged and what it becomes — pure
├── lib/patch.js         # how the guard gets in front of the fold — pure
├── test/                # unit tests, no harness required
├── README.md
└── LICENSE              # MIT
```

Host half only — no browser code. No npm runtime dependencies, no build step,
plain ESM.

## License

MIT

---

<a name="-русский"></a>
<details open>
<summary><h2>🇷🇺 Русский (Полное руководство)</h2></summary>

Патч защиты истории сессий для [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh):
**один некорректный ответ с нечисловыми токенами (`NaN`) больше не повреждает всю историю диалогов.**

## Какую проблему решает

При получении от нестандартного провайдера некорректных метрик использования токенов, стандартный парсер DSH падал при повторном открытии сессии (`history unavailable`). Плагин перехватывает сохранение и санитизирует поврежденные значения в безопасные числа.

## Установка

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

## Лицензия

MIT

</details>

---

<a name="-中文"></a>
<details>
<summary><h2>🇨🇳 中文 (完整技术文档)</h2></summary>

DeepSeek Harness 会话 Token 用量数据清洗与防崩守护插件：
**彻底防止因上游服务商返回异常用量数据 (`NaN`) 导致整条历史会话损坏崩溃。**

## 解决的核心痛点

当第三方模型接口返回格式错误的 Token 统计时，DSH 原生历史反序列化会直接报错中断 (`history unavailable`)。本插件在持久化前实时拦截并修正异常计数，保障会话永久稳定加载。

## 安装指南

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

## 开源协议

MIT

</details>
