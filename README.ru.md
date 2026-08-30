# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>Защита истории сессий от повреждения битыми данными токенов (NaN)</h3>

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

## ⚡ Обзор

**`dsh-usage-guard`** перехватывает и санитизирует повреждённые метрики токенов (`NaN`) от нестандартных API-провайдеров, предотвращая падение истории сессий при загрузке.

```mermaid
graph LR
    Upstream[Поток LLM от провайдера] -->|Отдаёт повреждённые токены NaN| Guard[Санитизатор dsh-usage-guard]
    Guard -->|Коррекция NaN в валидные числа| Storage[Хранилище истории сессий]
    Storage --> Clean[✅ Безопасная загрузка старых диалогов]
```

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
