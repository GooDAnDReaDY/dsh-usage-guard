import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

test('клиентский модуль регистрируется исключительно в слоте settings.plugin.item', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  let loadedModule = null
  const fakeWindow = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        loadedModule = { id, factory }
      },
    },
  }

  const context = vm.createContext({
    window: fakeWindow,
    setTimeout,
    clearTimeout,
  })
  vm.runInContext(code, context)

  assert.ok(loadedModule, 'window.__ModuleLoader__.load должен быть вызван')
  assert.equal(loadedModule.id, '@goodandready/dsh-usage-guard')

  const exports = loadedModule.factory((pkg) => {
    if (pkg === 'react') {
      return {
        useState: (init) => [init, () => {}],
        useRef: (init) => ({ current: init }),
        useEffect: () => {},
        createElement: () => ({}),
      }
    }
    return {}
  })

  assert.ok(exports.apply, 'клиентский модуль должен экспортировать apply')
  assert.ok(Array.isArray(exports.inject), 'клиентский модуль должен декларировать inject')
  assert.ok(exports.inject.includes('slots'), 'inject должен включать slots')
  assert.ok(exports.inject.includes('locale'), 'inject должен включать locale')
  assert.ok(exports.inject.includes('settingsScope'), 'inject должен включать settingsScope')

  const registeredSlots = []
  const fakeCtx = {
    locale: { register: () => {} },
    slots: {
      register: (desc, comp) => {
        registeredSlots.push({ desc, comp })
      },
    },
    effect: () => {},
  }

  exports.apply(fakeCtx)
  assert.equal(registeredSlots.length, 1, 'должен быть зарегистрирован ровно один слот')
  assert.equal(registeredSlots[0].desc.name, 'settings.plugin.item')
  assert.equal(registeredSlots[0].desc.key, 'dsh-usage-guard')
  assert.equal(registeredSlots[0].desc.locale, 'dsh-usage-guard')

  // Проверяем, что нет регистрации в settings.section
  const sectionSlots = registeredSlots.filter(s => s.desc.name === 'settings.section')
  assert.equal(sectionSlots.length, 0, 'не должно быть регистрации settings.section')
})
