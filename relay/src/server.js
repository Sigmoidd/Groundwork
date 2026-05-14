const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const EventEmitter = require('events');
const {
  ATTENDANCE_TOKEN_FIELDS,
  CAPABILITY_MIN_THRESHOLD,
  CAPABILITY_TOKEN_FIELDS,
  castShade,
  fitsBranch,
  fitsLantern,
  fitsStrictAttendanceAsk,
  fitsStrictCapabilityAsk,
  makeLantern,
  makeLeaf,
  openCanopy,
  readBundle,
  readLantern,
  readLeaf,
  thresholdRank,
  verifyBlindToken,
  stoneKey
} = require('./canopy');

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.ndjson');
const CANOPY_FILE = path.join(DATA_DIR, 'canopy.ndjson');
const LANTERN_FILE = path.join(DATA_DIR, 'lantern.ndjson');
const STONES_FILE = path.join(DATA_DIR, 'stones.ndjson');
const SAFETY_FILE = path.join(DATA_DIR, 'safety-signals.ndjson');
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 262144);
const MAX_EVENT_BODY_BYTES = Number(process.env.MAX_EVENT_BODY_BYTES || 131072);
const SPENT_NULLIFIER_RETENTION_MS = Number(process.env.SPENT_NULLIFIER_RETENTION_MS || 30 * 24 * 60 * 60 * 1000);
const ENABLE_LEGACY_TOKENS = process.env.CANOPY_ENABLE_LEGACY_TOKENS === '1';
const MAX_ISSUABLE_THRESHOLD = process.env.CANOPY_MAX_ISSUABLE_THRESHOLD || 'public';
const ALLOW_ATTENDANCE_CREDIT = process.env.CANOPY_ALLOW_ATTENDANCE_CREDIT === '1';
const ALLOW_ATTENDANCE_OCCURRENCE = process.env.CANOPY_ALLOW_ATTENDANCE_OCCURRENCE === '1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const RELAY_NAME = process.env.RELAY_NAME || 'Groundwork Relay';
const PUBLIC_KINDS = new Set([
  'resource_pin',
  'resource_pin_confirmed',
  'resource_pin_rated',
  'resource_pin_noted',
  'resource_pin_photo_added',
  'resource_pin_updated',
  'resource_pin_removed',
  'event_pin',
  'job_posted',
  'planting_request',
  'resource.pin.add',
  'resource.pin.confirmed',
  'resource.pin.rated',
  'resource.pin.noted',
  'resource.pin.photo.added',
  'resource.pin.seeded',
  'event.pin.add',
  'event.pin.expired'
]);
const ALLOWED_KINDS = new Set([...PUBLIC_KINDS, 'dm']);
const POST_LANES = {
  public: {
    name: 'public',
    writeEndpoint: 'POST /v1/events',
    readEndpoint: 'GET /v1/events',
    streamEndpoint: 'GET /v1/stream',
    exportEndpoint: 'GET /v1/export.ndjson',
    nostr: 'eligible for public Nostr-compatible mirroring',
    rule: 'Public civic posts are visible to everyone and must contain no private organizing detail.'
  },
  private: {
    name: 'private',
    writeEndpoint: 'POST /v1/events',
    readEndpoint: 'GET /v1/inbox/:recipient',
    streamEndpoint: '',
    exportEndpoint: '',
    nostr: 'never mirrored to Nostr',
    rule: 'Private posts require a recipient and are only returned from that recipient inbox.'
  },
  proof: {
    name: 'proof',
    writeEndpoint: 'POST /v1/canopy/* and POST /v1/lantern/*',
    readEndpoint: 'GET /v1/canopy/seed',
    streamEndpoint: '',
    exportEndpoint: '',
    nostr: 'never mirrored to Nostr',
    rule: 'GRTAP proofs are not posts; relays store only minimal replay and safety records.'
  }
};
const subscribers = new Set();
const bus = new EventEmitter();
const events = [];
const byId = new Map();
const writeCounts = new Map();
const stones = new Map();
let garden = null;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '');
}
for (const file of [CANOPY_FILE, LANTERN_FILE, STONES_FILE, SAFETY_FILE]) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '');
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function canonicalForHash(event) {
  const copy = {
    kind: event.kind,
    author: event.author,
    createdAt: event.createdAt,
    scope: event.scope,
    tile: event.tile || '',
    recipient: event.recipient || '',
    expiresAt: event.expiresAt || null,
    body: event.body,
    sig: event.sig || ''
  };
  return stableStringify(copy);
}

function loadEvents() {
  const lines = fs.readFileSync(DATA_FILE, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      byId.set(event.id, event);
      events.push(event);
    } catch (err) {
      console.error('Skipping bad line in events.ndjson:', err.message);
    }
  }
  events.sort((a, b) => a.createdAt - b.createdAt || a.receivedAt - b.receivedAt);
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function text(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function badRequest(res, message) {
  return json(res, 400, { ok: false, error: message });
}

function tooLarge(res) {
  return json(res, 413, { ok: false, error: 'payload too large' });
}

function getIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.trim()) {
    return xfwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const ip = getIp(req);
  const bucket = writeCounts.get(ip) || [];
  const fresh = bucket.filter((ts) => now - ts < windowMs);
  if (fresh.length >= limit) {
    writeCounts.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  writeCounts.set(ip, fresh);
  return true;
}

function pickScope(kind, requested) {
  if (kind === 'dm') return 'private';
  return requested === 'private' ? 'private' : 'public';
}

function describePostLane(event) {
  if (event.scope === 'private') {
    return {
      lane: 'private',
      read: '/v1/inbox/:recipient',
      recipient: event.recipient,
      nostr: false
    };
  }
  return {
    lane: 'public',
    read: '/v1/events',
    recipient: '',
    nostr: true
  };
}

function validateEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'event must be an object' };
  }
  const kind = String(input.kind || '').trim();
  if (!ALLOWED_KINDS.has(kind)) {
    return { ok: false, error: `unsupported kind: ${kind}` };
  }
  const author = String(input.author || '').trim();
  if (!author || author.length > 128) {
    return { ok: false, error: 'author is required and must be <= 128 chars' };
  }
  const tile = input.tile == null ? '' : String(input.tile).trim();
  if (tile.length > 96) {
    return { ok: false, error: 'tile must be <= 96 chars' };
  }
  const recipient = input.recipient == null ? '' : String(input.recipient).trim();
  if (kind === 'dm' && !recipient) {
    return { ok: false, error: 'dm events require recipient' };
  }
  if (recipient.length > 128) {
    return { ok: false, error: 'recipient must be <= 128 chars' };
  }
  const scope = pickScope(kind, input.scope);
  if (scope === 'private' && kind !== 'dm' && !recipient) {
    return { ok: false, error: 'private events require recipient' };
  }
  const body = input.body;
  if (body == null) {
    return { ok: false, error: 'body is required' };
  }
  const bodyBytes = Buffer.byteLength(stableStringify(body));
  if (bodyBytes > MAX_EVENT_BODY_BYTES) {
    return { ok: false, error: `body exceeds ${MAX_EVENT_BODY_BYTES} bytes` };
  }
  const createdAt = Number(input.createdAt || Date.now());
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return { ok: false, error: 'createdAt must be a valid epoch milliseconds number' };
  }
  const expiresAt = input.expiresAt == null ? null : Number(input.expiresAt);
  if (expiresAt != null && (!Number.isFinite(expiresAt) || expiresAt <= createdAt)) {
    return { ok: false, error: 'expiresAt must be after createdAt' };
  }
  const sig = input.sig == null ? '' : String(input.sig);
  if (sig.length > 4096) {
    return { ok: false, error: 'sig too large' };
  }

  const normalized = {
    kind,
    author,
    createdAt,
    scope,
    tile,
    recipient,
    body,
    sig,
    expiresAt
  };
  const id = input.id ? String(input.id) : sha256Hex(canonicalForHash(normalized));
  normalized.id = id;
  return { ok: true, event: normalized };
}

function appendEvent(event) {
  if (byId.has(event.id)) {
    return { stored: false, event: byId.get(event.id), duplicate: true };
  }
  const stored = { ...event, receivedAt: Date.now() };
  fs.appendFileSync(DATA_FILE, JSON.stringify(stored) + '\n');
  byId.set(stored.id, stored);
  events.push(stored);
  bus.emit('event', stored);
  return { stored: true, event: stored, duplicate: false };
}

function appendLine(file, value) {
  fs.appendFileSync(file, JSON.stringify({ ...value, receivedAt: Date.now() }) + '\n');
}

function publicThreshold(value) {
  const rank = thresholdRank(value);
  return rank >= 0 ? rank : 0;
}

function canIssueCapability(token) {
  const minimum = CAPABILITY_MIN_THRESHOLD[token.capability] || 'keeper';
  if (publicThreshold(token.thresholdClass) < publicThreshold(minimum)) {
    return { ok: false, error: `${token.capability} requires ${minimum} threshold` };
  }
  if (publicThreshold(token.thresholdClass) > publicThreshold(MAX_ISSUABLE_THRESHOLD)) {
    return { ok: false, error: 'capability unavailable' };
  }
  return { ok: true };
}

function canIssueAttendance(token) {
  if (token.attendanceClass === 'count') {
    return { ok: true };
  }
  if (token.attendanceClass === 'credit' && ALLOW_ATTENDANCE_CREDIT) {
    return { ok: true };
  }
  if (token.attendanceClass === 'occurrence' && ALLOW_ATTENDANCE_OCCURRENCE) {
    return { ok: true };
  }
  return { ok: false, error: 'attendance class unavailable' };
}

function canIssueBlindToken(token) {
  return token.kind === 'capability'
    ? canIssueCapability(token)
    : canIssueAttendance(token);
}

function loadStones() {
  const now = Date.now();
  const kept = [];
  const lines = fs.readFileSync(STONES_FILE, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      const expiresAt = Number(item?.expiresAt || item?.meta?.expiresAt || 0);
      const receivedAt = Number(item?.receivedAt || 0);
      const keepUntil = expiresAt
        ? expiresAt + SPENT_NULLIFIER_RETENTION_MS
        : receivedAt + SPENT_NULLIFIER_RETENTION_MS;
      if (item && item.key && (!Number.isFinite(keepUntil) || keepUntil > now)) {
        stones.set(item.key, keepUntil || 0);
        kept.push(item);
      }
    } catch (err) {
      console.error('Skipping bad line in stones.ndjson:', err.message);
    }
  }
  if (kept.length !== lines.length) {
    fs.writeFileSync(STONES_FILE, kept.map((item) => JSON.stringify(item)).join('\n') + (kept.length ? '\n' : ''));
  }
}

function layStone(kind, nullifier, meta = {}) {
  const key = stoneKey(kind, nullifier);
  const now = Date.now();
  const existingUntil = Number(stones.get(key) || 0);
  if (stones.has(key) && (!existingUntil || existingUntil > now)) {
    return { ok: false, error: 'already used' };
  }
  const expiresAt = Number(meta.expiresAt || 0);
  const keepUntil = expiresAt ? expiresAt + SPENT_NULLIFIER_RETENTION_MS : now + SPENT_NULLIFIER_RETENTION_MS;
  stones.set(key, keepUntil);
  appendLine(STONES_FILE, { key, kind, expiresAt: expiresAt || null, meta });
  return { ok: true, key };
}

function safeSignal(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'signal must be an object' };
  }
  const allowedKeys = new Set([
    'schema',
    'tokenKind',
    'nullifierHash',
    'signalClass',
    'observedAtBucket',
    'reportNonce'
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: 'signal contains disallowed detail' };
    }
  }
  if (payload.schema !== 'grtap.safety.signal.v1') {
    return { ok: false, error: 'unsupported signal schema' };
  }
  if (!['capability', 'attendance'].includes(payload.tokenKind)) {
    return { ok: false, error: 'unsupported tokenKind' };
  }
  const nullifierHash = String(payload.nullifierHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(nullifierHash)) {
    return { ok: false, error: 'nullifierHash must be sha256 hex' };
  }
  const signalClass = String(payload.signalClass || '').trim();
  if (!['serious_safety_concern', 'coercion_concern', 'spam_or_abuse'].includes(signalClass)) {
    return { ok: false, error: 'unsupported signalClass' };
  }
  const observedAtBucket = String(payload.observedAtBucket || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2})?$/.test(observedAtBucket)) {
    return { ok: false, error: 'observedAtBucket must be date or hour bucket' };
  }
  const reportNonce = String(payload.reportNonce || '').trim();
  if (!/^[A-Za-z0-9_-]{16,160}$/.test(reportNonce)) {
    return { ok: false, error: 'reportNonce must be base64url' };
  }
  return {
    ok: true,
    signal: {
      schema: payload.schema,
      tokenKind: payload.tokenKind,
      nullifierHash,
      signalClass,
      observedAtBucket,
      reportNonce
    }
  };
}

function eventVisibleForQuery(event, query) {
  if (query.kind && event.kind !== query.kind) return false;
  if (query.tile && event.tile !== query.tile) return false;
  if (query.author && event.author !== query.author) return false;
  if (query.recipient && event.recipient !== query.recipient) return false;
  if (query.scope && event.scope !== query.scope) return false;
  if (query.since && event.createdAt < query.since) return false;
  if (query.until && event.createdAt > query.until) return false;
  if (!query.includeExpired && event.expiresAt && event.expiresAt < Date.now()) return false;
  return true;
}

function queryEvents(query) {
  let result = events.filter((event) => eventVisibleForQuery(event, query));
  if (!query.includePrivate) {
    result = result.filter((event) => event.scope !== 'private');
  }
  result = result.sort((a, b) => b.createdAt - a.createdAt || b.receivedAt - a.receivedAt);
  return result.slice(0, query.limit);
}

function parseQuery(urlObj) {
  const qs = urlObj.searchParams;
  return {
    kind: qs.get('kind') || '',
    tile: qs.get('tile') || '',
    author: qs.get('author') || '',
    recipient: qs.get('recipient') || '',
    scope: qs.get('scope') || '',
    since: qs.get('since') ? Number(qs.get('since')) : 0,
    until: qs.get('until') ? Number(qs.get('until')) : 0,
    limit: Math.min(Number(qs.get('limit') || 100), 500),
    includePrivate: false,
    includeExpired: qs.get('includeExpired') === 'true'
  };
}

function handleStream(req, res, query) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': CORS_ORIGIN
  });

  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, relay: RELAY_NAME, now: Date.now() })}\n\n`);

  const backlog = queryEvents(query).reverse();
  for (const event of backlog) {
    res.write(`event: event\ndata: ${JSON.stringify(event)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
  }, 20_000);

  const handler = (event) => {
    const visible = eventVisibleForQuery(event, query);
    const privateAllowed = event.scope !== 'private';
    if (visible && privateAllowed) {
      res.write(`event: event\ndata: ${JSON.stringify(event)}\n\n`);
    }
  };

  bus.on('event', handler);
  subscribers.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('event', handler);
    subscribers.delete(res);
  });
}

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end();
}

function readJsonBody(req, res, callback) {
  let bytes = 0;
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BODY_BYTES) {
      tooLarge(res);
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body || '{}'));
    } catch {
      badRequest(res, 'invalid JSON body');
    }
  });
}

loadEvents();
loadStones();
garden = openCanopy(DATA_DIR);

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  if (req.method === 'GET' && urlObj.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      relay: RELAY_NAME,
      storedEvents: events.length,
      activeStreams: subscribers.size,
      supportedKinds: Array.from(ALLOWED_KINDS),
      postLanes: POST_LANES,
      canopy: {
        active: true,
        stones: stones.size,
        keyId: garden.keyId,
        suite: garden.suite
      }
    });
  }

  if (req.method === 'GET' && urlObj.pathname === '/v1/events') {
    const query = parseQuery(urlObj);
    query.includePrivate = false;
    return json(res, 200, { ok: true, events: queryEvents(query) });
  }

  if (req.method === 'GET' && urlObj.pathname.startsWith('/v1/inbox/')) {
    const recipient = decodeURIComponent(urlObj.pathname.replace('/v1/inbox/', ''));
    const query = parseQuery(urlObj);
    query.recipient = recipient;
    query.scope = 'private';
    query.includePrivate = true;
    return json(res, 200, { ok: true, events: queryEvents(query) });
  }

  if (req.method === 'GET' && urlObj.pathname === '/v1/stream') {
    const query = parseQuery(urlObj);
    return handleStream(req, res, query);
  }

  if (req.method === 'GET' && urlObj.pathname === '/v1/export.ndjson') {
    const lines = queryEvents({
      kind: urlObj.searchParams.get('kind') || '',
      tile: urlObj.searchParams.get('tile') || '',
      author: urlObj.searchParams.get('author') || '',
      recipient: urlObj.searchParams.get('recipient') || '',
      scope: urlObj.searchParams.get('scope') || '',
      since: urlObj.searchParams.get('since') ? Number(urlObj.searchParams.get('since')) : 0,
      until: urlObj.searchParams.get('until') ? Number(urlObj.searchParams.get('until')) : 0,
      limit: Math.min(Number(urlObj.searchParams.get('limit') || events.length), events.length || 1),
      includePrivate: false,
      includeExpired: urlObj.searchParams.get('includeExpired') === 'true'
    }).reverse().map((event) => JSON.stringify(event)).join('\n') + '\n';

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Content-Disposition': 'attachment; filename="events.ndjson"'
    });
    return res.end(lines);
  }

  if (req.method === 'GET' && urlObj.pathname === '/v1/canopy/seed') {
    return json(res, 200, {
      ok: true,
      seed: {
        schema: 'grtap.blind.seed.v1',
        keyId: garden.keyId,
        suite: garden.suite,
        modulusBytes: garden.modulusBytes,
        publicKeyPem: garden.publicKeyPem,
        publicJwk: garden.publicJwk,
        prepare: {
          name: 'PrepareBlindTokenMessage',
          messageEncoding: 'stable-json-sha384-domain-separated',
          capabilityTokenFields: CAPABILITY_TOKEN_FIELDS,
          attendanceTokenFields: ATTENDANCE_TOKEN_FIELDS,
          verifierRule: 'revealed token fields must match the visible ask envelope'
        }
      }
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/canopy/shade') {
    if (!rateLimit(req, 30)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      const checked = readBundle(payload, garden);
      if (!checked.ok) {
        return badRequest(res, checked.error);
      }
      const allowed = canIssueBlindToken(checked.bundle.request);
      if (!allowed.ok) {
        return json(res, 403, { ok: false, error: allowed.error });
      }
      let shade = '';
      try {
        shade = castShade(garden, checked.bundle.blinded);
      } catch (err) {
        return badRequest(res, err.message);
      }
      appendLine(CANOPY_FILE, {
        event: 'shade.cast',
        schema: checked.bundle.schema,
        keyId: checked.bundle.keyId,
        suite: checked.bundle.suite,
        tokenKind: checked.bundle.request.kind,
        capability: checked.bundle.request.capability || '',
        thresholdClass: checked.bundle.request.thresholdClass || '',
        attendanceClass: checked.bundle.request.attendanceClass || '',
        expiresAt: checked.bundle.request.expiresAt
      });
      return json(res, 201, {
        ok: true,
        shade: {
          schema: 'grtap.blind.response.v1',
          keyId: checked.bundle.keyId,
          suite: checked.bundle.suite,
          blindSig: shade,
          issuedAt: Date.now(),
          requestEcho: checked.bundle.request
        }
      });
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/canopy/leaf') {
    if (!ENABLE_LEGACY_TOKENS) {
      return json(res, 410, { ok: false, error: 'legacy capability tokens disabled; use blind token presentation' });
    }
    if (!rateLimit(req, 30)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      const leaf = makeLeaf(payload);
      const allowed = canIssueCapability(leaf);
      if (!allowed.ok) {
        return json(res, 403, { ok: false, error: allowed.error });
      }
      appendLine(CANOPY_FILE, {
        event: 'leaf.minted',
        capability: leaf.capability,
        thresholdClass: leaf.thresholdClass,
        relayScope: leaf.relayScope,
        actionScope: leaf.actionScope,
        expiresAt: leaf.expiresAt
      });
      return json(res, 201, { ok: true, leaf });
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/canopy/hold') {
    if (!rateLimit(req, 60)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      if (payload.token && payload.blindSig) {
        const checked = verifyBlindToken(payload.token, payload.blindSig, garden);
        if (!checked.ok) {
          return badRequest(res, checked.error);
        }
        if (checked.token.kind !== 'capability') {
          return badRequest(res, 'capability token required');
        }
        const branch = fitsStrictCapabilityAsk(checked.token, payload.ask);
        if (!branch.ok) {
          return badRequest(res, branch.error);
        }
        const stone = layStone('capability', checked.token.nullifier, {
          capability: checked.token.capability,
          thresholdClass: checked.token.thresholdClass,
          expiresAt: checked.token.expiresAt
        });
        if (!stone.ok) {
          return json(res, 409, { ok: false, error: stone.error });
        }
        return json(res, 200, {
          ok: true,
          held: {
            schema: checked.token.schema,
            kind: checked.token.kind,
            capability: checked.token.capability,
            thresholdClass: checked.token.thresholdClass,
            relayScopeHash: checked.token.relayScopeHash,
            actionScopeHash: checked.token.actionScopeHash,
            expiresAt: checked.token.expiresAt
          }
        });
      }
      if (!ENABLE_LEGACY_TOKENS) {
        return json(res, 410, { ok: false, error: 'legacy capability tokens disabled; use blind token presentation' });
      }
      const checked = readLeaf(payload.leaf || payload);
      if (!checked.ok) {
        return badRequest(res, checked.error);
      }
      const branch = fitsBranch(checked.leaf, payload.ask || {});
      if (!branch.ok) {
        return badRequest(res, branch.error);
      }
      const stone = layStone('leaf', checked.leaf.nullifier, {
        capability: checked.leaf.capability,
        thresholdClass: checked.leaf.thresholdClass,
        relayScope: checked.leaf.relayScope,
        actionScope: checked.leaf.actionScope,
        expiresAt: checked.leaf.expiresAt
      });
      if (!stone.ok) {
        return json(res, 409, { ok: false, error: stone.error });
      }
      return json(res, 200, {
        ok: true,
        held: {
          capability: checked.leaf.capability,
          thresholdClass: checked.leaf.thresholdClass,
          relayScope: checked.leaf.relayScope,
          actionScope: checked.leaf.actionScope,
          expiresAt: checked.leaf.expiresAt
        }
      });
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/lantern/glow') {
    if (!rateLimit(req, 30)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      if (payload.blindedMsg) {
        const checked = readBundle(payload, garden);
        if (!checked.ok) {
          return badRequest(res, checked.error);
        }
        if (checked.bundle.request.kind !== 'attendance') {
          return badRequest(res, 'attendance token required');
        }
        const allowed = canIssueAttendance(checked.bundle.request);
        if (!allowed.ok) {
          return json(res, 403, { ok: false, error: allowed.error });
        }
        let blindSig = '';
        try {
          blindSig = castShade(garden, checked.bundle.blinded);
        } catch (err) {
          return badRequest(res, err.message);
        }
        appendLine(LANTERN_FILE, {
          event: 'lantern.blind.cast',
          attendanceClass: checked.bundle.request.attendanceClass,
          expiresAt: checked.bundle.request.expiresAt
        });
        return json(res, 201, {
          ok: true,
          glow: {
            schema: 'grtap.blind.response.v1',
            keyId: checked.bundle.keyId,
            suite: checked.bundle.suite,
            blindSig,
            issuedAt: Date.now(),
            requestEcho: checked.bundle.request
          }
        });
      }
      if (!ENABLE_LEGACY_TOKENS) {
        return json(res, 410, { ok: false, error: 'legacy attendance tokens disabled; use blind token presentation' });
      }
      const lantern = makeLantern(payload);
      const allowed = canIssueAttendance(lantern);
      if (!allowed.ok) {
        return json(res, 403, { ok: false, error: allowed.error });
      }
      appendLine(LANTERN_FILE, {
        event: 'lantern.minted',
        attendanceClass: lantern.attendanceClass,
        eventCommitment: lantern.eventCommitment,
        expiresAt: lantern.expiresAt
      });
      return json(res, 201, { ok: true, lantern });
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/lantern/mark') {
    if (!rateLimit(req, 60)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      if (payload.token && payload.blindSig) {
        const checked = verifyBlindToken(payload.token, payload.blindSig, garden);
        if (!checked.ok) {
          return badRequest(res, checked.error);
        }
        if (checked.token.kind !== 'attendance') {
          return badRequest(res, 'attendance token required');
        }
        const lantern = fitsStrictAttendanceAsk(checked.token, payload.ask);
        if (!lantern.ok) {
          return badRequest(res, lantern.error);
        }
        const stone = layStone('attendance', checked.token.nullifier, {
          attendanceClass: checked.token.attendanceClass,
          expiresAt: checked.token.expiresAt
        });
        if (!stone.ok) {
          return json(res, 409, { ok: false, error: stone.error });
        }
        return json(res, 200, {
          ok: true,
          marked: {
            schema: checked.token.schema,
            kind: checked.token.kind,
            attendanceClass: checked.token.attendanceClass,
            eventCommitment: checked.token.eventCommitment,
            expiresAt: checked.token.expiresAt
          }
        });
      }
      if (!ENABLE_LEGACY_TOKENS) {
        return json(res, 410, { ok: false, error: 'legacy attendance tokens disabled; use blind token presentation' });
      }
      const checked = readLantern(payload.lantern || payload);
      if (!checked.ok) {
        return badRequest(res, checked.error);
      }
      const lantern = fitsLantern(checked.lantern, payload.ask || {});
      if (!lantern.ok) {
        return badRequest(res, lantern.error);
      }
      const stone = layStone('lantern', checked.lantern.nullifier, {
        attendanceClass: checked.lantern.attendanceClass,
        eventCommitment: checked.lantern.eventCommitment,
        expiresAt: checked.lantern.expiresAt
      });
      if (!stone.ok) {
        return json(res, 409, { ok: false, error: stone.error });
      }
      return json(res, 200, {
        ok: true,
        marked: {
          attendanceClass: checked.lantern.attendanceClass,
          eventCommitment: checked.lantern.eventCommitment,
          expiresAt: checked.lantern.expiresAt
        }
      });
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/canopy/signal') {
    if (!rateLimit(req, 20)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      const checked = safeSignal(payload);
      if (!checked.ok) {
        return badRequest(res, checked.error);
      }
      appendLine(SAFETY_FILE, checked.signal);
      return json(res, 202, { ok: true, stored: true });
    });
  }

  if (req.method === 'GET' && urlObj.pathname === '/v1/transport/policy') {
    return json(res, 200, {
      ok: true,
      summary: 'Public posts go to the public relay log and may be mirrored with Nostr-compatible transport. Private posts go only to recipient inboxes. GRTAP proofs are not posts.',
      lanes: POST_LANES,
      publicKinds: Array.from(PUBLIC_KINDS),
      privateKinds: ['dm', 'any supported kind with scope=private and recipient set']
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/v1/events') {
    if (!rateLimit(req)) {
      return json(res, 429, { ok: false, error: 'rate limited' });
    }
    return readJsonBody(req, res, (payload) => {
      const batch = Array.isArray(payload) ? payload : [payload];
      if (!batch.length) {
        return badRequest(res, 'empty batch');
      }
      if (batch.length > 100) {
        return badRequest(res, 'batch too large');
      }
      const stored = [];
      for (const item of batch) {
        const checked = validateEvent(item);
        if (!checked.ok) {
          return badRequest(res, checked.error);
        }
        const result = appendEvent(checked.event);
        stored.push({
          id: result.event.id,
          duplicate: result.duplicate,
          stored: result.stored,
          lane: describePostLane(result.event),
          event: result.event
        });
      }
      return json(res, 202, { ok: true, stored });
    });
  }

  if (req.method === 'GET' && urlObj.pathname === '/') {
    return text(
      res,
      200,
      `${RELAY_NAME}\n\nEndpoints:\nGET  /health\nGET  /v1/transport/policy\nGET  /v1/events\nPOST /v1/events\nGET  /v1/inbox/:recipient\nGET  /v1/stream\nGET  /v1/export.ndjson\nGET  /v1/canopy/seed\nPOST /v1/canopy/shade\nPOST /v1/canopy/hold\nPOST /v1/canopy/signal\nPOST /v1/lantern/glow\nPOST /v1/lantern/mark\n`
    );
  }

  return json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`${RELAY_NAME} listening on :${PORT}`);
  console.log(`Loaded ${events.length} events from ${DATA_FILE}`);
});
