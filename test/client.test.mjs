import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

test('клиентский модуль регистрируется в ModuleLoader с правильным ID и слотом', () => {
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

  // Вызов фабрики
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

  let registeredSlot = null
  const fakeCtx = {
    locale: { register: () => {} },
    slots: {
      inject: (name, cb) => cb(),
      register: (desc, comp) => {
        registeredSlot = { desc, comp }
      },
    },
    effect: () => {},
  }

  exports.apply(fakeCtx)
  assert.ok(registeredSlot, 'слот должен быть зарегистрирован')
  assert.equal(registeredSlot.desc.name, 'settings.plugin.item')
  assert.equal(registeredSlot.desc.key, 'dsh-usage-guard')
})