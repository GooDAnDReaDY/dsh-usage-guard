# DESIGN.md — Дизайн-контракт dsh-usage-guard

## Product / Purpose
- Назначение: Санитайзер расхода токенов и защита от сбоев истории сессий DeepSeek Harness при получении неполных или некорректных порций usage от провайдеров LLM.
- Аудитория: Пользователи и администраторы DeepSeek Harness.
- Статус: Production ready, активен в web-профиле ядра.

## User Surfaces
- Web/UI: Интегрированная карточка настроек плагина.
- DSH UI / settings / slots:
  - Слот: строго `settings.plugin.item` (вкладка «Настройки → Плагины → Настройки плагинов»).
  - Ключ слота (`entryKey`): `dsh-usage-guard` (полностью совпадает с namespace настроек).
  - Свой раздел бокового меню (`settings.section`): **отсутствует / deprecated** (запрещено стандартом DSH для карточек настроек).
- API: Cordis-плагин, патчит `sessionProjections`.
- CLI: Отсутствует (управление через DSH CLI: `dsh plugin --profile web ...`).
- Документация: `README.md`, `README.ru.md`, `README.zh.md`, `docs/design/DESIGN.md`.

## Visual Direction
- Атмосфера: Нативный компонент DeepSeek Harness, оформленный в едином стиле плагинов экосистемы по референсу `@goodandready/dsh-clinebot`.
- Утверждённые референсы: `@goodandready/dsh-clinebot`, системные карточки плагинов ядра DSH.
- Не копировать: Свои нестандартные стили, яркие несогласованные цвета, сторонние иконки или самодельные стрелки сворачивания.

## Foundations
- Цвета и роли:
  - Фоновые слои: `var(--dsw-alias-bg-layer-3)` (карточка), `var(--dsw-alias-bg-layer-2)` (вложенные карточки опций и телеметрии), `var(--dsw-alias-bg-layer-4)` (ховер кнопок).
  - Границы: `var(--dsw-alias-border-l2)`.
  - Текст: `var(--dsw-alias-label-primary)`, `var(--dsw-alias-label-secondary)`, `var(--dsw-alias-label-tertiary)`.
  - Акценты / бейджи: `var(--dsw-alias-state-success-primary)` с фоном `rgba(16,185,129,0.08)`, `var(--dsw-alias-state-warning-primary)` с фоном `rgba(245,158,11,0.08)`, `var(--dsw-alias-state-error-primary)` с фоном `rgba(239,68,68,0.08)`.
- Типографика: Системный шрифт DSH, заголовок карточки 15px/600, подписи 13px, бейджи 12px/500, телеметрия 13px/600.
- Сетка, отступы, responsive: Скругление карточки 12px, padding 18px 20px, gap 14px, вложенные карточки 8px radius.
- Accessibility:
  - Шапка карточки — нативный `<button>` с клавиатурным фокусом и `aria-expanded`.
  - Иконка шеврона векторная SVG, с плавной анимацией вращения 180deg и `aria-hidden="true"`.
  - Интерактивные чекбоксы связаны с `<label htmlFor="...">`.
  - Изоляция стилей: селекторы с префиксом `.ug-*`, тег `<style id="dsh-usage-guard-full-css" data-dsh-plugin="dsh-usage-guard">` монтируется через идемпотентный `ensureCss()` вне цикла рендера.

## Components And States
- Компоненты:
  ```
  .ug-section-card (li)
  ├── button.ug-head-btn (aria-expanded, click toggle)
  │   ├── div (title "Usage Guard" + subtitle)
  │   ├── span.ug-badge (.ug-badge-ok / .ug-badge-warn)
  │   └── span (Chevron SVG с поворотом transform .16s ease)
  └── ErrorBoundary (компонент защиты от сбоев рендера)
      └── div.ug-body (рендерится при open === true)
          ├── loading state (.ug-field-card, t('settings.loading'))
          ├── unavailable state (.ug-alert-bad, t('settings.unavailable'))
          ├── ready state:
          │   ├── .ug-stats-grid (индикация статуса защиты и целевой службы sessionProjections)
          │   ├── .ug-field-card (опция repair: label + input#ug-repair-toggle + description)
          │   ├── .ug-field-card (опция report: label + input#ug-report-toggle + description)
          │   ├── .ug-alert-ok / .ug-alert-bad (обратная связь сохранения)
          │   └── button.ug-btn.ug-btn-primary (сохранить изменения)
  ```
- Loading / empty / error / success:
  - `loading`: понятный индикатор загрузки настроек.
  - `ready`: актуальные поля формы, драфт синхронизируется при внешних обновлениях хоста, если форма не изменена локально (`!isDirty`).
  - `saving`: кнопка заблокирована, надпись «Saving…» / «Сохранение…».
  - `saved`: подтверждение об успешном сохранении исчезает через 4 сек или при изменении любого поля.
  - `error` / `boundary`: компонент `ErrorBoundary` перехватывает сбои в дочернем дереве и отображает блок с ошибкой и кнопкой «Retry» без поломки интерфейса DSH.

## User Flows
- Критические сценарии:
  1. Администратор открывает «Настройки → Плагины → Настройки плагинов», видит свернутую карточку «Usage Guard» со статусом «Защита активна» (`ug-badge-ok`).
  2. При клике на шапку карточка плавно раскрывается.
  3. Отображаются индикаторы режима и опции управления защитой и логированием.
  4. При изменении опций драфт обновляется, активируется кнопка сохранения.
  5. Сохранение обновляет настройки хоста, выдавая сообщение об успехе.

## Do / Don't
- Do:
  - Использовать строго канонический слот `settings.plugin.item`.
  - Применять переменные темы `--dsw-alias-*`.
  - Использовать `ensureCss()` вне цикла рендера.
  - Оборачивать UI в `ErrorBoundary`.
  - Использовать функцию интерполяции `makeT(ru, en)`.
- Don't:
  - Занимать боковое меню верхнего уровня (`settings.section`).
  - Использовать хардкод цветов (#fff, #2da44e и т.д.).
  - Допускать утечки интервалов таймеров в фоновых процессах.

## Locked Design Decisions
- **2026-09-10 (#6):** Оформление карточки приведено к единому стилю `dsh-clinebot` (`.ug-section-card`, `.ug-field-card`, `.ug-badge-ok`/`warn`, `.ug-btn`, `ErrorBoundary`, `ensureCss`, `makeT`, `refreshMirrorUntilVisible`).
- **2026-09-10 (#3):** Полный отказ от fallback-слота `settings.section`. Плагин регистрируется строго в `settings.plugin.item`.
- **2026-09-09 (v0.1.4):** Добавлен атрибут `data-dsh-plugin="dsh-usage-guard"` для защиты `<style>` при HMR/перезагрузке соседних плагинов.
- **2026-09-08 (v0.1.3):** Фоновые обновления настроек ядра синхронизируются с карточкой, если пользователь не держит локально изменённый несохранённый драфт (`isDirtyRef`).
- **2026-09-05 (v0.1.2):** Карточка настроек регистрируется строго в `settings.plugin.item` с ключом `dsh-usage-guard`.
