# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>DeepSeek Harness 会话用量数据清洗、历史记录防崩与 Token 算术保护插件</h3>

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

## ⚡ 核心痛点：服务商异常格式如何导致会话历史崩溃

在 **DeepSeek Harness** 中，会话累加统计 4 种 Token 计数：
* `inputTokens`
* `outputTokens`
* `cacheReadTokens`
* `cacheWriteTokens`

当非标服务商或本地代理返回 `prompt_tokens`、`null` 或 `NaN` 时，核心累加逻辑 (`total += usage.inputTokens`) 会将累计用量污染为 `NaN`，导致落盘后的**历史对话记录在下次打开时彻底崩溃**。

```mermaid
graph LR
    subgraph Malformed [服务商返回异常数据]
        API[模型输出流] -->|返回 prompt_tokens / NaN / null| Event[会话事件]
    end

    subgraph Unprotected [未开启防护]
        Event --> DSHMath[DSH 累加计算]
        DSHMath -->|total += NaN| Poison[🚨 累计用量全变为 NaN]
        Poison --> DiskDead[损坏的会话存储文件]
        DiskDead --> Crash[💥 前端打开对话直接白屏崩溃]
    end

    subgraph Guarded [开启 dsh-usage-guard]
        Event --> Interceptor[sessionProjections 拦截器]
        Interceptor --> AliasCheck{同义名字段映射}
        AliasCheck -->|prompt_tokens -> inputTokens| Restored[恢复有效数字]
        AliasCheck -->|缺失字段| Zero[安全兜底赋 0]
        Restored --> SafeMath[安全累加计算]
        Zero --> SafeMath
        SafeMath --> SafeDisk[✅ 会话历史 100% 完好无损]
    end

    style Malformed fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Unprotected fill:#311b1b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
    style Guarded fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## 🛡️ 多级清洗恢复体系

1. **同义名字段提取 (`borrowed`)**：智能映射 `prompt_tokens`、`completion_tokens`、`cached_tokens` 等数十种主流字段；
2. **有限数字有效性校验 (`sound`)**：严格过滤 `NaN`、`Infinity` 与字符串；
3. **安全 0 值兜底 (`repaired`)**：无法提取时安全填充 0，彻底阻断算术污染；
4. **内存无侵入拦截 (`lib/patch.js`)**：动态切入 `sessionProjections`，覆盖所有前置与后置投影。

---

## 📦 安装指南

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

## 📄 开源协议

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
