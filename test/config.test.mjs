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

function loadApply() {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  const body = code
    .replace(/^import\s+.*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/import\.meta\.url/g, '"file:///dummy"')
    + '\nreturn apply;'
  const fn = new Function('z', 'telemetry', 'usageOf', 'damage', 'healed', 'complaint', 'patchRegistry', 'registerPluginUpdater', body)
  return fn(mockZ, telemetry, usageOf, damage, healed, complaint, patchRegistry, registerPluginUpdater)
}

test('lib/index.js использует z.natural() и не содержит несовместимых методов Zod (.int(), .nonnegative())', () => {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(code, /maxStepTokens:\s*z\s*\.\s*natural\(\)/, 'maxStepTokens должен объявляться через z.natural()')
  assert.doesNotMatch(code, /\.int\(\)/, 'в схеме schemastery не должно быть вызова .int()')
  assert.doesNotMatch(code, /\.nonnegative\(\)/, 'в схеме schemastery не должно быть вызова .nonnegative()')
})

test('при сервисе настроек без watch плагин логирует предупреждение и сообщает о работе на значениях по умолчанию (#20)', () => {
  const apply = loadApply()
  const warnings = []
  const fakeCtx = {
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            register: () => ({
              get: () => ({ repair: true, report: true, maxStepTokens: 0 }),
            }),
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
  assert.ok(warnings.length > 0, 'должно быть залогировано предупреждение')
  assert.ok(
    warnings.some((w) => w.includes('watch') && w.includes('default config')),
    'предупреждение должно сообщать об отсутствии watch и работе на значениях по умолчанию'
  )
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
