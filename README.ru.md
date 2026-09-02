# 📦 @goodandready/dsh-usage-guard

<div align="center">

<h3>Санитайзер расхода токенов, защита от сбоев истории и сохранение сессий для DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-usage-guard"><img src="https://img.shields.io/npm/v/@goodandready/dsh-usage-guard.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/Все_проекты_автора-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="Все проекты автора"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ В чём суть проблемы: как провайдеры ломают историю сессий

В ядре **DeepSeek Harness** подсчёт суммарного расхода токенов складывается из четырёх счётчиков:

```javascript
uncachedInputTokens: usage.inputTokens,        // Без подстраховки в ядре DSH!
outputTokens:        usage.outputTokens,       // Без подстраховки в ядре DSH!
cacheReadTokens:     usage.cacheReadTokens ?? 0,
cacheWriteTokens:    usage.cacheWriteTokens ?? 0,
```

Поля кэша ядро подстраховывает через `?? 0`, а первые два берёт **как есть, без проверки на число**.

Когда сторонний провайдер, локальный движок инференса, шлюз или роутер присылает нестандартные названия полей, пустые значения или `NaN`, стандартное сложение (`total += usage.inputTokens`) превращает сумму расхода сессии в `NaN`.

После этого валидация схемы в ядре отвергает выжимку сессии:
```
history unavailable for session "<session-id>": expected number, received NaN
```

Поскольку история сессий в DSH рассчитывается на лету **путём повторного проигрывания журнала событий**, одна-единственная битая порция токенов навсегда блокирует открытие диалога в веб-интерфейсе.

```mermaid
graph LR
    subgraph Malformed [Поток данных провайдера]
        API[Ответ модели] -->|Присылает prompt_tokens / NaN / null| Event[Событие сессии]
    end

    subgraph Unprotected [Без dsh-usage-guard]
        Event --> DSHMath[Сложение расхода в ядре DSH]
        DSHMath -->|total += NaN| Poison[🚨 Сумма расхода становится NaN]
        Poison --> SchemaFail[Отказ проверки схемы]
        SchemaFail --> DeadHistory[💥 История сессии заблокирована навсегда]
    end

    subgraph Guarded [С активным dsh-usage-guard]
        Event --> Patch[Перехватчик sessionProjections]
        Patch --> AliasCheck{Поиск по синонимам}
        AliasCheck -->|prompt_tokens -> inputTokens| Restored[Восстановленное число]
        AliasCheck -->|Если число отсутствует| ZeroFallback[Безопасный 0]
        Restored --> SafeMath[Корректное сложение]
        ZeroFallback --> SafeMath
        SafeMath --> ValidHistory[✅ 100% Восстановленная и сохранная история]
    end

    style Malformed fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Unprotected fill:#311b1b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
    style Guarded fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## ✨ Ключевые возможности и механизмы защиты

### 1. Мгновенное восстановление ранее сломанных сессий
Плагин **не модифицирует** файлы журналов на диске. Он встаёт перед операцией сложения в памяти. Так как проигрывание сессий идёт через эту же точку, **все ранее повреждённые сессии начинают открываться снова сразу после установки плагина**.

### 2. Полный словарь синонимов полей (`borrowed`)
Прежде чем подставлять ноль, плагин ищет значения в общепринятых полях других API:

| Целевое поле DSH | Распознаваемые синонимы |
|---|---|
| `inputTokens` | `input_tokens`, `input`, `promptTokens`, `prompt_tokens`, `promptTokenCount`, `prompt_eval_count` |
| `outputTokens` | `output_tokens`, `output`, `completionTokens`, `completion_tokens`, `candidatesTokenCount`, `eval_count` |
| `cacheReadTokens` | `cache_read_tokens`, `cachedTokens`, `cached_tokens`, `cache_read_input_tokens`, `cachedContentTokenCount`, `prompt_tokens_details.cached_tokens` |
| `cacheWriteTokens` | `cache_write_tokens`, `cacheCreationTokens`, `cache_creation_input_tokens` |

### 3. Проверка на конечное неотрицательное число (`sound`)
Проверка `typeof value === 'number' && Number.isFinite(value) && value >= 0` гарантирует отсечение `NaN`, `Infinity`, `null`, `undefined`, отрицательных чисел (напр. `-1` при ошибках прокси) и строк.

### 4. Безопасная подстановка нуля (`repaired`)
Если число найти не удалось, подставляется `0`. Выбор делается в пользу приблизительного счёта вместо полностью заблокированной истории.

### 5. Безопасный перехват в памяти (`lib/patch.js`)
* **Существующие проекции**: оборачивает все методы `.apply` в `sessionProjections.registrations` с полным сохранением контекста `this`.
* **Поздние проекции**: перехватывает будущие регистрации через хук `map.set`.
* **Комплексная защита**: защищает не только токены, но и формулы давления на контекст и разбор занятости.
* **Нулевой оверхед**: поверхностное клонирование применяется только к объекту расхода.

### 6. Дедуплицированное журналирование (`told`)
Выводит предупреждение с идентификатором сессии, номером хода, шагом и способом починки (взят по синониму или обнулён). Одинаковые инциденты не спамят в лог при повторных проигрываниях, а размер кэша ограничен 1000 записей для предотвращения утечек памяти.

---

## 🚀 Изменения в версии v0.1.1 (Changed in v0.1.1)

* **Защита от отрицательных чисел (`nonnegative`)**:
  В v0.1.0 значение `-1` (возвращаемое некоторыми шлюзами при ошибках) проходило проверку конечности числа и ломало схему DSH (`z.number().int().nonnegative()`). Начиная с v0.1.1 функция `sound()` строго требует `value >= 0`. Отрицательные значения теперь признаются повреждёнными и безопасно обнуляются.
* **Безопасная коэрция числовых строк (Stringified Numbers)**:
  Если провайдер возвращает валидное количество токенов строкой (например, `inputTokens: "1540"`), плагин в v0.1.1 больше не сбрасывает его в ноль, а безопасно приводит к настоящему числу (`1540`).
* **Расширенная совместимость с экосистемами моделей**:
  - **Google Gemini API**: добавлены `promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`.
  - **Ollama native API**: добавлены `prompt_eval_count`, `eval_count`.
  - **OpenAI prompt caching**: добавлена поддержка вложенного объекта `prompt_tokens_details.cached_tokens`.
* **Сохранение контекста вызова `this` в проекциях**:
  В `lib/patch.js` метод `wrapApply` переписан с сохранением `this` (`original.call(this, state, guard(event))`), обеспечивая полную совместимость с объектно-ориентированными проекциями.
* **Отказоустойчивое логирование без риска краша**:
  В функции `complaint()` сериализация данных экранирована `try...catch`, предотвращая падение рантайма при наличии циклических структур или `BigInt`.
* **Изолированная межсессионная дедупликация**:
  Ключ дедупликации предупреждений дополнен контекстом сессии (`sessionId`), что предотвращает ложное подавление сообщений об ошибках в последующих диалогах. Множество `told` ограничено 1000 элементами для защиты от утечек памяти.

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-usage-guard
```

---

## ⚙️ Параметры конфигурации (`settings.yaml`)

```yaml
dsh-usage-guard:
  repair: true
  report: true
```

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `repair` | `boolean` | `true` | Заменять пропущенные и нечисловые значения на ноль до сложения |
| `report` | `boolean` | `true` | Логировать информацию о поврежденных порциях в консоль |

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)