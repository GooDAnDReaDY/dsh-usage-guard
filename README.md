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

Session token-usage sanitizer for DeepSeek Harness: prevents chat history corruption when providers return malformed or non-numeric token metrics (`NaN`).

### Features

- **NaN Protection**: Sanitizes missing or invalid token counters before history serialization.
- **Session Crash Prevention**: Guarantees past chat sessions load smoothly without replay crashes.
- **Zero Performance Impact**: Lightweight synchronous middleware.

### Install

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

<a name="-русский"></a>
<details open>
<summary><h2>🇷🇺 Русский (Полное руководство)</h2></summary>

Защита истории сессий от повреждения битыми данными токенов в DeepSeek Harness: исключает падение истории диалогов при получении некорректных значений (`NaN`).

### Возможности

- **Защита от NaN**: санитизирует отсутствующие или нечисловые счетчики токенов до их сохранения.
- **Стабильность истории**: гарантирует бесперебойную загрузку старых диалогов без ошибок.
- **Нулевой оверхед**: легковесный фоновый middleware без задержек.

### Установка

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

</details>

---

<a name="-中文"></a>
<details>
<summary><h2>🇨🇳 中文 (完整技术文档)</h2></summary>

DeepSeek Harness 会话 Token 用量数据清洗与防崩守护插件：防止服务商返回格式错误的用量数据 (`NaN`) 导致历史记录损坏。

### 核心亮点

- **`NaN` 异常修复**：在历史记录持久化前自动将无效计数器修正为安全数值。
- **保障会话稳定性**：彻底解决因上游数据异常引发的历史会话加载崩溃。
- **零性能损耗**：轻量级后台同步拦截器。

### 安装方法

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

</details>
