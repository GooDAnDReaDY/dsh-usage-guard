// lib/telemetry.js — In-memory telemetry accumulator for dsh-usage-guard
// Tracks rescued malformed usage samples, fixed NaN counters, and clamped token spikes.

class UsageGuardTelemetry {
  constructor() {
    this.rescuedEvents = 0;
    this.fixedTokens = 0;
    this.clampedSpikes = 0;
    this.lastIncident = null;
    this.maxRecentIncidents = 20;
    this.recentIncidents = [];
  }

  recordIncident({ turn = 0, step = 0, badFields = [], fixedTokenCount = 0, clamped = false, provider = 'unknown', sample = null, kind = 'malformed-usage', target = '' } = {}) {
    this.rescuedEvents += 1;
    this.fixedTokens += Number(fixedTokenCount) || 0;
    if (clamped) {
      this.clampedSpikes += 1;
    }

    const incident = {
      timestamp: new Date().toISOString(),
      kind: String(kind),
      turn: turn ?? 0,
      step: step ?? 0,
      target: String(target || (Array.isArray(badFields) ? badFields.join(',') : '')),
      fields: Array.isArray(badFields) ? badFields : [],
      clamped: Boolean(clamped),
      provider: typeof provider === 'string' ? provider : 'unknown',
      sample: sample && typeof sample === 'object' ? JSON.stringify(sample).slice(0, 300) : null,
    };

    this.lastIncident = incident;
    this.recentIncidents.unshift(incident);
    if (this.recentIncidents.length > this.maxRecentIncidents) {
      this.recentIncidents.pop();
    }
    return incident;
  }

  recordRescue(tokens = 0) {
    this.rescuedEvents += 1;
    this.fixedTokens += Number(tokens) || 0;
  }

  recordClamped(tokens = 0) {
    this.clampedSpikes += 1;
    this.fixedTokens += Number(tokens) || 0;
  }

  getSnapshot() {
    return {
      rescuedEvents: this.rescuedEvents,
      fixedTokens: this.fixedTokens,
      clampedSpikes: this.clampedSpikes,
      lastIncident: this.lastIncident ? { ...this.lastIncident } : null,
      recentIncidents: this.recentIncidents.map((i) => ({ ...i })),
    };
  }

  reset() {
    this.rescuedEvents = 0;
    this.fixedTokens = 0;
    this.clampedSpikes = 0;
    this.lastIncident = null;
    this.recentIncidents = [];
  }
}

export const telemetry = new UsageGuardTelemetry();

export function recordIncident(options) {
  return telemetry.recordIncident(options);
}

export function recordRescue(tokens) {
  return telemetry.recordRescue(tokens);
}

export function recordClamped(tokens) {
  return telemetry.recordClamped(tokens);
}

export function getSnapshot() {
  return telemetry.getSnapshot();
}

export function resetTelemetry() {
  telemetry.reset();
}

export function registerTelemetryRoute(ctx, options = {}) {
  const endpoint = options.endpoint || '/api/dsh-usage-guard/telemetry';
  return ctx.webServer.register({
    kind: 'exact',
    path: endpoint,
    handler: async (request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' });
        response.end();
        return;
      }
      const snapshot = telemetry.getSnapshot();
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(snapshot));
    },
  });
}
