import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isTrustedUpdateRequest, registerPluginUpdater, findDshCliEntry } from '../lib/updater.js'

test('isTrustedUpdateRequest отклоняет нелокальные и недоверенные запросы', () => {
  // Отсутствие заголовка x-dsh-plugin-update
  assert.equal(
    isTrustedUpdateRequest({
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'запрос без заголовка x-dsh-plugin-update: 1 должен быть отклонен'
  )

  // Не loopback адрес
  assert.equal(
    isTrustedUpdateRequest({
      headers: { 'x-dsh-plugin-update': '1', origin: 'http://192.168.1.50:3000', host: '192.168.1.50:3000' },
      socket: { remoteAddress: '192.168.1.50' },
    }),
    false,
    'удаленный IP должен быть отклонен'
  )

  // Не same-origin
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'cross-site запрос должен быть отклонен'
  )

  // Несовпадение host и origin
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        origin: 'http://localhost:4000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'несовпадающий origin и host должен быть отклонен'
  )

  // Валидный локальный запрос
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'same-origin',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    true,
    'доверенный same-origin loopback запрос должен приниматься'
  )
})

test('registerPluginUpdater монтирует маршрут обновления с проверкой методов', async () => {
  let registered = null
  const fakeCtx = {
    webServer: {
      register: (route) => {
        registered = route
        return () => {}
      },
    },
  }

  registerPluginUpdater(fakeCtx, {
    endpoint: '/api/dsh-usage-guard/update',
    packageName: '@goodandready/dsh-usage-guard',
  })

  assert.ok(registered)
  assert.equal(registered.path, '/api/dsh-usage-guard/update')
  assert.equal(registered.kind, 'exact')

  // DELETE запрос должен возвращать 405 Method Not Allowed
  let status = 0
  await registered.handler({ method: 'DELETE' }, {
    writeHead: (s) => { status = s },
    end: () => {},
  })
  assert.equal(status, 405)
})

test('findDshCliEntry корректно разыменовывает симлинки и находит бинарник dsh (#37)', () => {
  assert.equal(findDshCliEntry(undefined), undefined)
  assert.equal(findDshCliEntry(''), undefined)
  assert.equal(findDshCliEntry('/nonexistent/path/to/dsh'), undefined)

  // Создаем временную структуру пакета с bin и симлинком
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cli-test-'))
  try {
    const pkgDir = path.join(tmpDir, 'node_modules', '@deepseek-ai', 'dsh')
    fs.mkdirSync(pkgDir, { recursive: true })
    const binDir = path.join(tmpDir, 'bin')
    fs.mkdirSync(binDir, { recursive: true })

    const binScript = path.join(pkgDir, 'lib', 'bin.js')
    fs.mkdirSync(path.dirname(binScript), { recursive: true })
    fs.writeFileSync(binScript, '// bin script')

    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: '@deepseek-ai/dsh',
      version: '0.1.6',
      bin: { dsh: './lib/bin.js' }
    }))

    const symlinkBin = path.join(binDir, 'dsh')
    fs.symlinkSync(binScript, symlinkBin)

    // Проверяем: запуск через симлинк обязан разрешиться и найти бинарник
    const found = findDshCliEntry(symlinkBin)
    assert.equal(found, fs.realpathSync(binScript), 'findDshCliEntry должен найти целевой bin.js через symlink')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
