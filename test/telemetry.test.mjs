import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  recordIncident,
  recordRescue,
  recordClamped,
  getSnapshot,
  telemetry,
  isTrustedSettingsRequest,
  registerTelemetryRoute,
} from '../lib/telemetry.js'

test('телеметрия корректно накапливает события спасения и починенные токены', () => {
  telemetry.reset()
  let snap = getSnapshot()
  assert.equal(snap.rescuedEvents, 0)
  assert.equal(snap.fixedTokens, 0)
  assert.equal(snap.clampedSpikes, 0)
  assert.equal(snap.recentIncidents.length, 0)

  recordRescue(1500)
  recordRescue(250)
  recordClamped(100000)

  snap = getSnapshot()
  assert.equal(snap.rescuedEvents, 2)
  assert.equal(snap.fixedTokens, 101750)
  assert.equal(snap.clampedSpikes, 1)
})

test('телеметрия сохраняет кольцевой буфер инцидентов до 20 записей без утечки raw sample и provider (#45)', () => {
  telemetry.reset()
  for (let i = 0; i < 25; i++) {
    recordIncident({
      kind: 'spike-clamped',
      turn: i,
      step: 1,
      target: 'inputTokens',
      badFields: ['inputTokens'],
      provider: 'secret-provider-leak',
      sample: { secret_prompt_tokens: 2000000 },
    })
  }

  const snap = getSnapshot()
  assert.equal(snap.recentIncidents.length, 20, 'буфер инцидентов должен быть ограничен 20 записями')
  assert.equal(snap.recentIncidents[0].turn, 24, 'первая запись должна быть самой новой (инцидент 24)')
  assert.equal(snap.recentIncidents[19].turn, 5, 'старейшая оставшаяся запись должна иметь turn = 5')
  assert.ok(snap.recentIncidents[0].timestamp, 'инцидент должен содержать временную метку ISO')

  // #45 DoD: No raw usage sample or unnecessary session metadata is returned
  for (const inc of snap.recentIncidents) {
    assert.equal(inc.sample, undefined, 'raw sample не должен сохраняться или возвращаться')
    assert.equal(inc.provider, undefined, 'provider не должен сохраняться или возвращаться в телеметрии')
    assert.ok(inc.fields, 'fields должны сохраняться для диагностики')
    assert.ok(inc.target, 'target должен сохраняться')
  }
})

test('isTrustedSettingsRequest: валидация доверенных источников (#45)', () => {
  // 1. Cross-site request is unconditionally rejected
  assert.equal(isTrustedSettingsRequest({
    headers: { 'sec-fetch-site': 'cross-site' },
    socket: { remoteAddress: '127.0.0.1' },
  }), false, 'cross-site должен быть отклонен')

  // 2. Mismatched origin rejected (CSRF)
  assert.equal(isTrustedSettingsRequest({
    headers: {
      host: '127.0.0.1:3080',
      origin: 'https://evil-attacker.com',
    },
    socket: { remoteAddress: '192.168.1.55' },
  }), false, 'чужой origin должен быть отклонен')

  // 3. Remote unauthenticated request rejected
  assert.equal(isTrustedSettingsRequest({
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '192.168.1.55' },
  }), false, 'удаленный неаутентифицированный запрос должен быть отклонен')

  // 4. Same-origin browser request allowed
  assert.equal(isTrustedSettingsRequest({
    headers: {
      'sec-fetch-site': 'same-origin',
      host: '127.0.0.1:3080',
      referer: 'http://127.0.0.1:3080/settings',
    },
    socket: { remoteAddress: '192.168.1.55' },
  }), true, 'same-origin браузерный запрос должен быть разрешен')

  // 5. Loopback request allowed (curl / internal IPC)
  assert.equal(isTrustedSettingsRequest({
    headers: { host: 'localhost:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), true, 'loopback 127.0.0.1 должен быть разрешен')
  assert.equal(isTrustedSettingsRequest({
    headers: { host: 'localhost:3080' },
    socket: { remoteAddress: '::1' },
  }), true, 'loopback ::1 должен быть разрешен')

  // 6. Bearer token matching expectedToken allowed
  assert.equal(isTrustedSettingsRequest({
    headers: {
      authorization: 'Bearer valid-secret-token',
    },
    socket: { remoteAddress: '192.168.1.55' },
  }, { expectedToken: 'valid-secret-token' }), true, 'валидный Bearer токен должен быть разрешен')

  assert.equal(isTrustedSettingsRequest({
    headers: {
      authorization: 'Bearer invalid-token',
    },
    socket: { remoteAddress: '192.168.1.55' },
  }, { expectedToken: 'valid-secret-token' }), false, 'неверный токен должен быть отклонен')

  // 7. same-site without Origin or Referer is strictly rejected (#51)
  assert.equal(isTrustedSettingsRequest({
    headers: {
      'sec-fetch-site': 'same-site',
      host: '127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false, 'запрос с sec-fetch-site: same-site без Origin должен быть отклонен')

  // 8. Loopback with mismatched origin rejected (#51)
  assert.equal(isTrustedSettingsRequest({
    headers: {
      host: '127.0.0.1:3080',
      origin: 'http://attacker-site.local:9000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false, 'loopback запрос с чужим origin должен быть отклонен')
})

test('registerTelemetryRoute: 403 на неавторизованные запросы и 200 на авторизованные (#45)', async () => {
  telemetry.reset()
  recordRescue(500)

  let registeredRoute = null
  const fakeCtx = {
    webServer: {
      register: (route) => {
        registeredRoute = route
        return () => {}
      },
    },
  }

  registerTelemetryRoute(fakeCtx, { endpoint: '/api/dsh-usage-guard/telemetry' })
  assert.ok(registeredRoute)
  assert.equal(registeredRoute.path, '/api/dsh-usage-guard/telemetry')

  // A. Unauthorized request -> 403 Forbidden
  {
    let statusCode = 0
    let writtenData = ''
    const fakeReq = {
      method: 'GET',
      headers: { host: '127.0.0.1:3080' },
      socket: { remoteAddress: '192.168.1.99' },
    }
    const fakeRes = {
      writeHead: (status) => { statusCode = status },
      end: (data) => { writtenData = data },
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 403, 'неавторизованный запрос должен получить 403')
    assert.match(writtenData, /Forbidden/)
  }

  // B. Cross-site request -> 403 Forbidden
  {
    let statusCode = 0
    const fakeReq = {
      method: 'GET',
      headers: { 'sec-fetch-site': 'cross-site' },
      socket: { remoteAddress: '127.0.0.1' },
    }
    const fakeRes = {
      writeHead: (status) => { statusCode = status },
      end: () => {},
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 403, 'cross-site запрос должен получить 403')
  }

  // C. Authorized loopback request -> 200 OK
  {
    let statusCode = 0
    let writtenData = ''
    const fakeReq = {
      method: 'GET',
      headers: { host: 'localhost:3080' },
      socket: { remoteAddress: '127.0.0.1' },
    }
    const fakeRes = {
      writeHead: (status) => { statusCode = status },
      end: (data) => { writtenData = data },
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 200, 'авторизованный loopback запрос должен получить 200')
    const parsed = JSON.parse(writtenData)
    assert.equal(parsed.rescuedEvents, 1)
    assert.equal(parsed.fixedTokens, 500)
  }

  // D. HEAD request handling: 200 without body when authorized, 403 without body when unauthorized
  {
    let statusCode = 0
    let writtenData = 'should-stay-undefined'
    const fakeReq = {
      method: 'HEAD',
      headers: { host: 'localhost:3080' },
      socket: { remoteAddress: '127.0.0.1' },
    }
    const fakeRes = {
      writeHead: (status) => { statusCode = status },
      end: (data) => { writtenData = data },
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 200, 'HEAD запрос должен получить 200')
    assert.equal(writtenData, undefined, 'HEAD ответ не должен содержать body')
  }

  {
    let statusCode = 0
    let writtenData = 'should-stay-undefined'
    const fakeReq = {
      method: 'HEAD',
      headers: { 'sec-fetch-site': 'cross-site' },
      socket: { remoteAddress: '127.0.0.1' },
    }
    const fakeRes = {
      writeHead: (status) => { statusCode = status },
      end: (data) => { writtenData = data },
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 403, 'неавторизованный HEAD запрос должен получить 403')
    assert.equal(writtenData, undefined, 'неавторизованный HEAD ответ не должен содержать body')
  }

  // E. Disallowed methods -> 405 Method Not Allowed
  {
    let statusCode = 0
    let headers = null
    const fakeReq = {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    }
    const fakeRes = {
      writeHead: (status, h) => { statusCode = status; headers = h },
      end: () => {},
    }

    await registeredRoute.handler(fakeReq, fakeRes)
    assert.equal(statusCode, 405, 'POST должен возвращать 405')
    assert.equal(headers?.allow, 'GET, HEAD')
  }
})
