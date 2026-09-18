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
    setInterval,
    clearInterval,
    console,
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
        useCallback: (fn) => fn,
        createElement: () => ({}),
        Component: class {},
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
  const registeredLocales = []
  const fakeCtx = {
    locale: {
      current: 'zh-CN',
      get: () => 'zh-CN',
      register: (ns, locale, dict) => {
        registeredLocales.push({ ns, locale, dict })
      },
    },
    slots: {
      register: (desc, comp) => {
        registeredSlots.push({ desc, comp })
      },
    },
    effect: (fn) => {
      if (typeof fn === 'function') fn()
    },
  }

  exports.apply(fakeCtx)
  assert.equal(registeredSlots.length, 1, 'должен быть зарегистрирован ровно один слот')
  assert.equal(registeredSlots[0].desc.name, 'settings.plugin.item')
  assert.equal(registeredSlots[0].desc.key, 'dsh-usage-guard')
  assert.equal(registeredSlots[0].desc.locale, 'dsh-usage-guard')

  // Проверяем, что нет регистрации в settings.section
  const sectionSlots = registeredSlots.filter(s => s.desc.name === 'settings.section')
  assert.equal(sectionSlots.length, 0, 'не должно быть регистрации settings.section')

  // Проверяем регистрацию канонических словарей локализации: en и zh
  assert.ok(registeredLocales.some(l => l.locale === 'en'), 'en словарь должен быть зарегистрирован')
  assert.ok(registeredLocales.some(l => l.locale === 'zh'), 'zh словарь должен быть зарегистрирован')
  assert.ok(!registeredLocales.some(l => l.locale === 'ru'), 'ru словарь не должен быть вшит в бандл (русификация строго через dsh-russian-lang)')
})

test('в client.js отсутствуют захардкоженные кириллические строки локализации', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // Никаких кириллических символов во фронтенд-бандле
  const cyrillicMatch = /[\u0400-\u04FF]/.exec(code)
  assert.equal(cyrillicMatch, null, 'client.js не должен содержать кириллических символов; русификация делегируется dsh-russian-lang')
})

test('getActiveLocale корректно определяет китайский и fallback на английский', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let loadedModule = null
  const fakeWindow = { __ModuleLoader__: { load: (m) => { loadedModule = m } } }
  vm.runInContext(code, vm.createContext({ window: fakeWindow, setTimeout, clearTimeout, setInterval, clearInterval }))

  const exports = loadedModule.factory(() => ({}))
  const { getActiveLocale } = exports
  assert.equal(typeof getActiveLocale, 'function')

  assert.equal(getActiveLocale({ locale: { getLocale: () => ({ active: 'zh-CN' }) } }), 'zh')
  assert.equal(getActiveLocale({ locale: { getSnapshot: () => ({ active: 'zh-TW' }) } }), 'zh')
  assert.equal(getActiveLocale({ locale: { getLocale: () => ({ locale: 'zh' }) } }), 'zh')
  assert.equal(getActiveLocale({ locale: { getLocale: () => ({ active: 'en-US' }) } }), 'en')
  assert.equal(getActiveLocale({ locale: { getLocale: () => ({ active: 'ru-RU' }) } }), 'en') // ru falls back to en in client bundle
  assert.equal(getActiveLocale(null), 'en')
  assert.equal(getActiveLocale({}), 'en')
})

test('makeT выполняет корректный fallback и подстановку переменных {var}', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let loadedModule = null
  const fakeWindow = { __ModuleLoader__: { load: (m) => { loadedModule = m } } }
  vm.runInContext(code, vm.createContext({ window: fakeWindow, setTimeout, clearTimeout, setInterval, clearInterval }))

  const exports = loadedModule.factory(() => ({}))
  const { makeT } = exports
  assert.equal(typeof makeT, 'function')

  const zh = {
    greeting: '你好, {name}!',
    mode: '模式: {mode}',
  }
  const en = {
    greeting: 'Hello, {name}!',
    fallbackOnly: 'Only English',
  }

  const t = makeT(zh, en)
  assert.equal(t('greeting', { name: 'DSH' }), '你好, DSH!')
  assert.equal(t('mode', { mode: 'Safe' }), '模式: Safe')
  assert.equal(t('fallbackOnly'), 'Only English')
  assert.equal(t('unknown_key'), 'unknown_key')
})

test('ensureCss внедряет стиль с нужным id и data-dsh-plugin', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let loadedModule = null
  const fakeWindow = { __ModuleLoader__: { load: (m) => { loadedModule = m } } }
  const appendedElements = []
  const fakeDocument = {
    getElementById: (id) => appendedElements.find(el => el.id === id) || null,
    createElement: (tag) => ({
      tagName: tag,
      id: '',
      dataset: {},
      textContent: '',
    }),
    head: {
      appendChild: (el) => appendedElements.push(el),
    },
  }

  vm.runInContext(code, vm.createContext({
    window: fakeWindow,
    document: fakeDocument,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  }))

  const exports = loadedModule.factory(() => ({}))
  const { ensureCss } = exports
  assert.equal(typeof ensureCss, 'function')

  ensureCss()
  assert.equal(appendedElements.length, 1)
  assert.equal(appendedElements[0].id, 'dsh-usage-guard-full-css')
  assert.equal(appendedElements[0].dataset.dshPlugin, 'dsh-usage-guard')
  assert.match(appendedElements[0].textContent, /\.ug-section-card/)

  // Идемпотентность — повторный вызов не дублирует <style>
  ensureCss()
  assert.equal(appendedElements.length, 1)
})

test('createErrorBoundary перехватывает ошибки и возвращает компонент сброса', () => {
  const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let loadedModule = null
  const fakeWindow = { __ModuleLoader__: { load: (m) => { loadedModule = m } } }
  vm.runInContext(code, vm.createContext({ window: fakeWindow, setTimeout, clearTimeout, setInterval, clearInterval }))

  class FakeReactComponent {
    constructor(props) {
      this.props = props
      this.state = {}
    }
    setState(updater) {
      this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater }
    }
  }

  const exports = loadedModule.factory((pkg) => {
    if (pkg === 'react') {
      return {
        Component: FakeReactComponent,
        createElement: (type, props, ...children) => ({ type, props, children }),
      }
    }
    return {}
  })

  const { createErrorBoundary } = exports
  const ErrorBoundary = createErrorBoundary()
  assert.ok(ErrorBoundary)

  const derived = ErrorBoundary.getDerivedStateFromError(new Error('Boom'))
  assert.equal(derived.hasError, true)
  assert.equal(derived.error.message, 'Boom')

  const instance = new ErrorBoundary({ children: 'OK' })
  assert.equal(instance.render(), 'OK')

  instance.state = { hasError: true, error: new Error('Render crash') }
  const rendered = instance.render()
  assert.equal(rendered.type, 'div')
  assert.equal(rendered.props.className, 'ug-alert-bad')
})
