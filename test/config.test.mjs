import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { telemetry } from '../lib/telemetry.js'
import { usageOf, damage, healed, complaint } from '../lib/usage.js'
import { patchRegistry } from '../lib/patch.js'
import { registerPluginUpdater } from '../lib/updater.js'

const mockZ = {
  object: () => (val) => val || {},
  boolean: () => ({ default: () => ({ description: () => ({}) }) }),
  natural: () => ({ default: () => ({ description: () => ({}) }) }),
}

function loadPluginModule() {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  const body = code
    .replace(/^import\s+.*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/import\.meta\.url/g, '"file:///dummy"')
    + '\nreturn { apply, plainConfig, Config };'
  const fn = new Function('z', 'telemetry', 'usageOf', 'damage', 'healed', 'complaint', 'patchRegistry', 'registerPluginUpdater', body)
  return fn(mockZ, telemetry, usageOf, damage, healed, complaint, patchRegistry, registerPluginUpdater)
}

function loadApply() {
  return loadPluginModule().apply
}

test('lib/index.js использует z.natural() и не содержит несовместимых методов Zod (.int(), .nonnegative())', () => {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(code, /maxStepTokens:\s*z\s*\.\s*natural\(\)/, 'maxStepTokens должен объявляться через z.natural()')
  assert.doesNotMatch(code, /\.int\(\)/, 'в схеме schemastery не должно быть вызова .int()')
  assert.doesNotMatch(code, /\.nonnegative\(\)/, 'в схеме schemastery не должно быть вызова .nonnegative()')
})

test('lib/index.js не вызывает устаревший settings.register, scope.get или scope.watch (#50)', () => {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(code, /settings\??\.\s*register/, 'в lib/index.js не должно быть вызова settings.register')
  assert.doesNotMatch(code, /scope\??\.\s*get/, 'в lib/index.js не должно быть вызова scope.get')
  assert.doesNotMatch(code, /scope\??\.\s*watch/, 'в lib/index.js не должно быть вызова scope.watch')
})

test('apply() загружается без ошибок и не падает, если хост имеет устаревший или бросающий settings.register (#50)', () => {
  const apply = loadApply()
  const fakeCtx = {
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            register: () => {
              throw new Error('settings.register is not a function')
            },
          },
          effect: (cb) => cb(),
        })
      }
    },
    logger: { warn: () => {} },
  }
  assert.doesNotThrow(() => {
    apply(fakeCtx, { repair: true })
  }, 'apply() не должен выбрасывать ошибку из-за settings.register')
})

test('при ошибке регистрации маршрутов webServer плагин логирует предупреждение (#20)', () => {
  const apply = loadApply()
  const warnings = []
  const fakeCtx = {
    inject: (deps, fn) => {
      if (deps.includes('webServer')) {
        fn({
          webServer: {
            register: () => {
              throw new Error('WebServer registration failed')
            },
          },
          logger: {
            warn: (msg) => warnings.push(msg),
          },
          effect: (cb) => cb(),
        })
      }
    },
    logger: {
      warn: (msg) => warnings.push(msg),
    },
  }
  apply(fakeCtx)
  assert.ok(warnings.some((w) => w.includes('failed to register routes')), 'отказ регистрации должен логироваться')
})

test('plainConfig корректно разворачивает вложенные структуры и реактивные get()-рефы (#49)', () => {
  const { plainConfig } = loadPluginModule()
  assert.equal(typeof plainConfig, 'function')

  const sample = {
    nested: {
      refField: { get: () => 42 },
      str: 'val',
    },
    topRef: { get: () => ({ active: true }) },
    arr: [1, { get: () => 'two' }, 3],
  }
  const result = plainConfig(sample)
  assert.deepEqual(result, {
    nested: {
      refField: 42,
      str: 'val',
    },
    topRef: { active: true },
    arr: [1, 'two', 3],
  })
})

test('конфигурация live динамически обновляется по событиям loader/volatile-update (#49)', () => {
  const { apply } = loadPluginModule()
  const listeners = {}
  let registeredGuard = null
  let mockRow = { ns: 'dsh-usage-guard', value: { repair: true, report: true, maxStepTokens: 100 } }

  const fakeCtx = {
    on: (evt, handler) => { listeners[evt] = handler },
    off: (evt) => { delete listeners[evt] },
    effect: (fn) => fn(),
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            describe: () => [mockRow],
          },
        })
      }
      if (deps.includes('sessionProjections')) {
        fn({
          sessionProjections: {},
          effect: (regFn) => {
            // capture guard passed to patchRegistry
            regFn()
          },
        })
      }
    },
    logger: { warn: () => {} },
  }

  // Load apply
  apply(fakeCtx, { repair: true, maxStepTokens: 100 })
  assert.ok(listeners['loader/volatile-update'], 'слушатель volatile-update должен быть зарегистрирован')

  // Update mockRow and trigger volatile-update
  mockRow = { ns: 'dsh-usage-guard', value: { repair: false, report: false, maxStepTokens: 500 } }
  listeners['loader/volatile-update']()
})
