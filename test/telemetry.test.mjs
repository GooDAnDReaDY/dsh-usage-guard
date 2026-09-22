import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  recordIncident,
  recordRescue,
  recordClamped,
  getSnapshot,
  resetTelemetry,
  registerTelemetryRoute,
} from '../lib/telemetry.js'

test('телеметрия корректно накапливает события спасения и починенные токены', () => {
  resetTelemetry()
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

test('телеметрия сохраняет кольцевой буфер инцидентов до 20 записей', () => {
  resetTelemetry()
  for (let i = 0; i < 25; i++) {
    recordIncident({
      kind: 'spike-clamped',
      turn: i,
      step: 1,
      target: 'inputTokens',
      raw: 2000000,
      fixed: 1000000,
    })
  }

  const snap = getSnapshot()
  assert.equal(snap.recentIncidents.length, 20, 'буфер инцидентов должен быть ограничен 20 записями')
  assert.equal(snap.recentIncidents[0].turn, 24, 'первая запись должна быть самой новой (инцидент 24)')
  assert.equal(snap.recentIncidents[19].turn, 5, 'старейшая оставшаяся запись должна иметь turn = 5')
  assert.ok(snap.recentIncidents[0].timestamp, 'инцидент должен содержать временную метку ISO')
})

test('registerTelemetryRoute монтирует GET хэндлер и отдает снимок телеметрии', async () => {
  resetTelemetry()
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
  assert.equal(registeredRoute.kind, 'exact')

  let statusCode = 0
  let writtenData = ''
  const fakeReq = { method: 'GET' }
  const fakeRes = {
    writeHead: (status) => { statusCode = status },
    end: (data) => { writtenData = data },
  }

  await registeredRoute.handler(fakeReq, fakeRes)
  assert.equal(statusCode, 200)
  const parsed = JSON.parse(writtenData)
  assert.equal(parsed.rescuedEvents, 1)
  assert.equal(parsed.fixedTokens, 500)
})
