# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>DeepSeek Harness 会话用量数据清洗与历史记录防崩守护插件</h3>

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

## ⚡ 插件概览

**`dsh-usage-guard`** 在持久化前实时拦截并清洗服务商返回的格式错误 Token 计数 (`NaN`)，保障对话历史记录永久平稳读取。

```mermaid
graph LR
    Upstream[服务商模型输出流] -->|返回异常 NaN 用量计数| Guard[dsh-usage-guard 清洗中间件]
    Guard -->|修正为安全数值| Storage[会话历史持久化]
    Storage --> Clean[✅ 杜绝历史记录解析报错]
```

---

## 📦 安装指南

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

## 📄 开源协议

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
