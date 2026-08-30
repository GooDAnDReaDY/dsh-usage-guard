# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>Защита истории сессий от повреждения битыми данными токенов (NaN), санитизация расхода и страховка арифметики для DeepSeek Harness</h3>

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

## ⚡ В чём проблема: как провайдеры ломают историю сессий

В ядре **DeepSeek Harness** подсчёт суммарного расхода токенов в сессиях складывается из четырёх счётчиков:
* `inputTokens`
* `outputTokens`
* `cacheReadTokens`
* `cacheWriteTokens`

Харнесс ожидает, что провайдер всегда присылает корректные конечные числа для `inputTokens` и `outputTokens`.

Однако нестандартные провайдеры, локальные движки инференса (vLLM, Ollama), кастомные роутеры и прокси часто отдают данные в ином формате:
* **Чужие имена полей**: `prompt_tokens`, `promptTokens`, `input`, `completion_tokens`, `output`, `cached_tokens`;
* **Пропущенные поля**: `undefined` или `null`;
* **Нечисловые значения**: `NaN`, `Infinity` или строки.

При сложении (`total += usage.inputTokens`) любое значение `NaN` или `undefined` превращает всю накопленную сумму в `NaN`. После сохранения файла на диск **вся история диалога становится нечитаемой и намертво роняет веб-интерфейс при повторном открытии**.

```mermaid
graph LR
    subgraph Malformed [Поток данных провайдера]
        API[Ответ модели] -->|Присылает prompt_tokens / NaN / null| Event[Событие сессии]
    end

    subgraph Unprotected [Без dsh-usage-guard]
        Event --> DSHMath[Сложение расхода в DSH]
        DSHMath -->|total += NaN| Poison[🚨 Сумма расхода превращается в NaN]
        Poison --> DiskDead[Повреждённый файл сессии на диске]
        DiskDead --> Crash[💥 Падение Web UI при открытии диалога]
    end

    subgraph Guarded [С активным dsh-usage-guard]
        Event --> Interceptor[Перехватчик sessionProjections]
        Interceptor --> AliasCheck{Поиск по синонимам}
        AliasCheck -->|prompt_tokens -> inputTokens| Restored[Восстановленное число]
        AliasCheck -->|Если поле отсутствует| Zero[Безопасный ноль]
        Restored --> SafeMath[Корректное сложение]
        Zero --> SafeMath
        SafeMath --> SafeDisk[✅ Полностью сохранная история сессий]
    end

    style Malformed fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Unprotected fill:#311b1b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
    style Guarded fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## 🛡️ Многоуровневая система восстановления

`dsh-usage-guard` перехватывает события службы `sessionProjections` до вызова арифметики и восстанавливает повреждённые данные:

### 1. Поиск по синонимам (`borrowed`)
Прежде чем подставлять ноль, плагин проверяет альтернативные названия полей:
* **`inputTokens`** ← `prompt_tokens`, `promptTokens`, `input`
* **`outputTokens`** ← `completion_tokens`, `completionTokens`, `output`
* **`cacheReadTokens`** ← `cache_read_tokens`, `cachedTokens`, `cached_tokens`, `cache_read_input_tokens`
* **`cacheWriteTokens`** ← `cache_write_tokens`, `cacheCreationTokens`, `cache_creation_input_tokens`

### 2. Проверка на конечное число (`sound`)
Проверка `typeof value === 'number' && Number.isFinite(value)` исключает `NaN`, `Infinity` и строки.

### 3. Безопасная подстановка нуля (`repaired`)
Если число найти не удалось, подставляется `0`. Это предотвращает порчу арифметики и сохраняет доступ к истории сессии.

### 4. Журналирование инцидентов (`complaint`)
При исправлении битой порции плагин логирует номер хода, шаг и способ исправления (взят по синониму или обнулён).

---

## 🔌 Безопасный перехват в памяти (`lib/patch.js`)

Плагин патчит реестр проекций `sessionProjections` без модификации исходных файлов ядра:
* **Существующие проекции**: оборачивает все уже зарегистрированные обработчики `.apply`.
* **Поздние проекции**: перехватывает будущие регистрации через хук `map.set`.
* **Нулевой оверхед**: поверхностное клонирование только по пути объекта расхода, все остальные ссылки остаются оригинальными.

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
