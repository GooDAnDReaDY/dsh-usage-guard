// Как заплатка встаёт перед сложением.
//
// Реестр проекций сессии — служба с открытой картой записей. Каждая запись
// держит обезличенную копию того, что зарегистрировал владелец, и зовёт `apply`
// именно у копии. Значит, подменять надо её, а не то, что владелец отдал при
// регистрации.
//
// Порядок загрузки не гарантирован, и на деле проекция ядра заводится позже
// нас. Подменять при этом метод `register` у службы бесполезно: до неё
// добираются через посредника, и замена, поставленная на посредника, до
// настоящего вызова не доезжает. Поэтому цепляемся за саму карту записей —
// обычный Map, один и тот же для всех, кто до него дотянулся.
//
// Оборачиваются все проекции, а не одна «нужная». Порцию расхода читает не
// только счёт токенов: давление на контекст считает её своей формулой, разбор
// занятости — своей, и каждая спотыкается об один и тот же пропущенный
// счётчик. Список ключей пришлось бы держать в согласии с чужим кодом, а
// обезвреживатель для здорового события возвращает ровно то же событие — тем,
// кто расхода не касается, он обходится в одно сравнение.

/** Метка на подменённой функции: второй раз оборачивать нечего. */
export const PATCHED = Symbol.for('dsh-usage-guard.patched')

/**
 * Обернуть складывание одной записи реестра с сохранением контекста this.
 *
 * @returns функция возврата к исходному состоянию.
 */
export function wrapApply(def, guard) {
  if (!def || typeof def.apply !== 'function' || def.apply[PATCHED]) return () => {}
  const original = def.apply
  const patched = function (state, event) {
    return original.call(this, state, guard(event))
  }
  patched[PATCHED] = true
  def.apply = patched
  return () => {
    if (def.apply === patched) def.apply = original
  }
}

/**
 * Поставить заплатку на реестр проекций.
 *
 * @param registry - служба `sessionProjections`.
 * @param guard - обезвреживатель события; получает событие, возвращает его же
 *                или исправленное.
 * @returns функция, снимающая всё поставленное, в обратном порядке.
 */
export function patchRegistry(registry, guard) {
  const undo = []
  const map = registry && typeof registry === 'object' ? registry.registrations : undefined
  if (!map || typeof map.set !== 'function' || typeof map.values !== 'function') return () => {}

  // Успели завестись раньше нас — оборачиваем прямо сейчас.
  for (const entry of map.values()) {
    if (entry && entry.def) undo.push(wrapApply(entry.def, guard))
  }

  // Заведутся позже — поймаем на укладке в карту.
  const set = map.set
  if (!set[PATCHED]) {
    const patched = function (key, value) {
      if (value && value.def) undo.push(wrapApply(value.def, guard))
      return set.call(this, key, value)
    }
    patched[PATCHED] = true
    map.set = patched
    undo.push(() => {
      if (map.set === patched) delete map.set
    })
  }

  return () => {
    for (const step of undo.reverse()) step()
    undo.length = 0
  }
}