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

  recordIncident({ turn = 0, step = 0, badFields = [], fixedTokenCount = 0, clamped = false, kind = 'malformed-usage', target = '' } = {}) {
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

function header(request, name) {
  const value = request?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isLoopbackAddress(value) {
  const address = String(value || '').toLowerCase().replace(/^[[\]]/g, '');
  return address === 'localhost' || address === 'localhost.' || address === '::1'
    || address.startsWith('127.')
    || address.startsWith('::ffff:127.');
}

/** Reject cross-site and unauthenticated requests while allowing same-origin and local callers. */
export function isTrustedSettingsRequest(request, options = {}) {
  if (!request || typeof request !== 'object' || !request.headers) return false;

  const secFetchSite = header(request, 'sec-fetch-site');
  // Unconditionally reject cross-site requests
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const host = header(request, 'x-forwarded-host') || header(request, 'host');
  const origin = header(request, 'origin');
  if (origin) {
    try {
      const url = new URL(origin);
      if (host && url.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
      if (isLoopbackAddress(url.hostname) && isLoopbackAddress(request?.socket?.remoteAddress)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const referer = header(request, 'referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (host && url.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
      if (isLoopbackAddress(url.hostname) && isLoopbackAddress(request?.socket?.remoteAddress)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Check Bearer token or custom auth header
  const expectedToken = options.expectedToken
    || (typeof process !== 'undefined' ? (process.env?.DSH_AUTH_TOKEN || process.env?.DSH_TOKEN) : null);

  const auth = header(request, 'authorization');
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim();
    if (expectedToken && bearer && bearer === expectedToken) {
      return true;
    }
  }

  const customAuth = header(request, 'x-dsh-auth');
  if (expectedToken && customAuth && customAuth === expectedToken) {
    return true;
  }

  // Check cookie authentication
  const cookie = header(request, 'cookie');
  if (typeof cookie === 'string' && expectedToken) {
    const match = cookie.match(/(?:^|;\s*)(?:token|dsh-auth|dsh_token)=([^;]+)/);
    if (match && match[1] === expectedToken) {
      return true;
    }
  }

  // Same-origin or same-site fetch
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return true;
  }

  // Loopback connection (curl, local process)
  if (isLoopbackAddress(request?.socket?.remoteAddress)) {
    return true;
  }

  return false;
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
      if (!isTrustedSettingsRequest(request, options)) {
        response.writeHead(403, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Forbidden: untrusted or cross-site request' }));
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
