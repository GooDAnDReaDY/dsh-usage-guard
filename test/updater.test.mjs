import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedUpdateRequest, registerPluginUpdater } from '../lib/updater.js'

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
