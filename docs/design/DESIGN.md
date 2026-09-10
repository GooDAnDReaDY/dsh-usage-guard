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
- Атмосфера: Нативный компонент DeepSeek Harness, строго мимикрирующий под дизайн системных карточек ядра.
- Утверждённые референсы: Системные карточки плагинов ядра DSH («Консоль», «Цикл агента»).
- Не копировать: Свои нестандартные стили, яркие несогласованные цвета, сторонние иконки или самодельные стрелки сворачивания.

## Foundations
- Цвета и роли:
  - Фоновые слои: `var(--dsw-alias-bg-layer-3)`.
  - Границы: `var(--dsw-alias-border-l2)`.
  - Текст: `var(--dsw-alias-label-primary)`, `var(--dsw-alias-label-secondary)`, `var(--dsw-alias-label-tertiary)`.
  - Акценты / бейджи: `var(--dsw-alias-color-success)`, `var(--dsw-alias-color-warning)`.
- Типографика: Системный шрифт DSH, заголовок 15px/600, подписи 13px, бейдж 11px/600.
- Сетка, отступы, responsive: Скругление карточки 12px, padding шапки 14px 16px, gap 12px.
- Accessibility:
  - Шапка карточки — нативный `<button>` с клавиатурным фокусом и `aria-expanded`.
  - Иконка шеврона помечена `aria-hidden="true"`.
  - Интерактивные чекбоксы связаны с `<label htmlFor="...">`.
  - Изоляция стилей: селекторы с префиксом `.ug-*`, тег `<style>` помечен `data-dsh-plugin="dsh-usage-guard"`.

## Components And States
- Компоненты:
  ```
  .ug-card
  ├── button.ug-head (aria-expanded, click toggle)
  │   ├── span.ug-title ("Usage Guard")
  │   ├── span.ug-sub ("Token-usage sanitizer & session crash protection")
  │   ├── span.ug-badge (ACTIVE [зелёный] / REPORT ONLY [жёлтый])
  │   └── Chevron (.ug-chev, .ug-chev-open, aria-hidden="true")
  └── div.ug-body (рендерится при раскрытии)
      ├── loading state (если snapshot.status === 'loading')
      ├── unavailable state (если snapshot.status === 'unavailable')
      ├── fields list (если snapshot.status === 'ready')
      │   ├── field repair (label + input#ug-repair-toggle + description)
      │   └── field report (label + input#ug-report-toggle + description)
      └── div.ug-foot
          ├── status msg (автоматически исчезает через 3 сек, сбрасывается при драфте)
          └── button.ug-save ("Save", disabled при saving)
  ```
- Loading / empty / error / success:
  - `loading`: краткий индикатор ожидания снимка хоста.
  - `ready`: актуальные поля формы, драфт синхронизируется при внешних обновлениях, если форма не изменена локально (`!isDirty`).
  - `saving`: кнопка заблокирована, надпись «Saving…».
  - `saved`: сообщение об успешном сохранении исчезает через 3 сек или при изменении любого поля.
  - `unavailable` / `error`: вывод понятного сообщения без падения всей карточки.

## User Flows
- Критические сценарии:
  1. Администратор открывает «Настройки → Плагины → Настройки плагинов», видит свернутую карточку «Usage Guard» со статусом `ACTIVE`.
  2. При клике на карточку открываются опции `repair` и `report`.
  3. Изменение опции помечает форму изменённой, кнопка «Save» активируется.
  4. Сохранение обновляет настройки хоста, появляется подтверждение «Saved».

## Do / Don't
- Do:
  - Использовать строго канонический слот `settings.plugin.item`.
  - Применять переменные темы `--dsw-alias-*`.
  - Сворачивать карточку по умолчанию.
- Don't:
  - Занимать боковое меню верхнего уровня (`settings.section`).
  - Использовать хардкод цветов (`#fff`, `#000`, `rgba`).
  - Хардкодить переводы в клиентском коде — использовать канонический `en` через `locale.register`.

## Locked Design Decisions
- **2026-09-10 (#3):** Полный отказ от fallback-слота `settings.section`. Плагин регистрируется строго в `settings.plugin.item` в соответствии с каноном DSH.
- **2026-09-09 (v0.1.4):** Добавлен атрибут `data-dsh-plugin="dsh-usage-guard"` для защиты `<style>` при HMR/перезагрузке соседних плагинов.
- **2026-09-08 (v0.1.3):** Автоматическое исчезновение обратной связи сохранения через 3 секунды и мгновенный сброс текста при редактировании чекбоксов для исключения ложной иллюзии сохранённого драфта.
- **2026-09-08 (v0.1.3):** Фоновые обновления настроек ядра синхронизируются с карточкой, если пользователь не держит локально изменённый несохранённый драфт (`isDirtyRef`).
- **2026-09-05 (v0.1.2):** Карточка настроек регистрируется строго в `settings.plugin.item` с ключом `dsh-usage-guard`.
- **2026-09-05 (v0.1.2):** Бейдж статуса в шапке наглядно показывает текущий режим защиты (`ACTIVE` при `repair === true` или `REPORT ONLY` при отключённом автоисправлении).
