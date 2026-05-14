const DEFAULT_NOSTR_KIND = 39701;
const HEX64_RE = /^[a-f0-9]{64}$/i;

function safeText(value, fallback = '') {
  return String(value == null ? fallback : value).trim();
}

function parseRelayList(value) {
  return safeText(value)
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => /^wss?:\/\//i.test(item));
}

function normalizeSecretKey(value) {
  const secret = safeText(value).toLowerCase();
  return HEX64_RE.test(secret) ? secret : '';
}

function normalizeKind(value) {
  const kind = Number(value || DEFAULT_NOSTR_KIND);
  if (!Number.isInteger(kind) || kind < 1 || kind >= 40000) {
    return DEFAULT_NOSTR_KIND;
  }
  return kind;
}

function readNostrConfig(env = process.env) {
  return {
    enabled: env.NOSTR_MIRROR_ENABLED === '1',
    secretKey: normalizeSecretKey(env.NOSTR_MIRROR_SECRET_KEY || env.NOSTR_PRIVATE_KEY),
    relays: parseRelayList(env.NOSTR_MIRROR_RELAYS || ''),
    kind: normalizeKind(env.NOSTR_MIRROR_KIND),
    sourceUrl: safeText(env.NOSTR_MIRROR_SOURCE_URL || ''),
    relayName: safeText(env.RELAY_NAME || 'Groundwork Relay')
  };
}

function hexToBytes(hex) {
  if (!HEX64_RE.test(hex)) {
    throw new Error('Nostr signing key must be 32-byte hex');
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function eventTimeSeconds(event) {
  const createdAt = Number(event?.createdAt || Date.now());
  return Math.floor((Number.isFinite(createdAt) ? createdAt : Date.now()) / 1000);
}

function ensureMirrorable(event, publicKinds) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('relay event must be an object');
  }
  if (event.scope !== 'public') {
    throw new Error('private relay events cannot be mirrored to Nostr');
  }
  if (event.recipient) {
    throw new Error('recipient-scoped relay events cannot be mirrored to Nostr');
  }
  if (!publicKinds.has(event.kind)) {
    throw new Error('relay event kind is not public mirrorable');
  }
  if (!event.id) {
    throw new Error('relay event id is required');
  }
}

function buildNostrTags(event, config) {
  const tags = [
    ['d', `groundwork:${event.id}`],
    ['client', 'groundwork-okc'],
    ['source', 'groundwork-relay'],
    ['groundwork:id', event.id],
    ['groundwork:kind', event.kind],
    ['groundwork:scope', 'public'],
    ['alt', `Groundwork public ${event.kind}`]
  ];

  if (event.tile) {
    tags.push(['groundwork:tile', String(event.tile)]);
  }
  if (config.sourceUrl) {
    tags.push(['r', `${config.sourceUrl.replace(/\/+$/, '')}/v1/events`]);
  }
  return tags;
}

function buildNostrContent(event, config) {
  return JSON.stringify({
    schema: 'groundwork.nostr.public.v1',
    source: {
      relay: config.relayName,
      relayEventId: event.id,
      relayKind: event.kind,
      relayScope: event.scope,
      createdAt: event.createdAt,
      tile: event.tile || ''
    },
    body: event.body
  });
}

function buildNostrTemplate(event, config, publicKinds) {
  ensureMirrorable(event, publicKinds);
  return {
    kind: config.kind,
    created_at: eventTimeSeconds(event),
    tags: buildNostrTags(event, config),
    content: buildNostrContent(event, config)
  };
}

async function signRelayEvent(event, config, publicKinds) {
  if (!config.secretKey) {
    throw new Error('Nostr mirror signing key is not configured');
  }
  const { finalizeEvent } = await import('nostr-tools/pure');
  return finalizeEvent(buildNostrTemplate(event, config, publicKinds), hexToBytes(config.secretKey));
}

async function signRelayEvents(events, config, publicKinds) {
  const signed = [];
  const skipped = [];
  for (const event of events) {
    try {
      signed.push(await signRelayEvent(event, config, publicKinds));
    } catch (err) {
      skipped.push({ id: event?.id || '', reason: err.message });
    }
  }
  return { signed, skipped };
}

function mirrorPolicy(config, publicKinds) {
  return {
    configured: Boolean(config.secretKey),
    enabled: config.enabled,
    kind: config.kind,
    publicKey: '',
    relays: config.relays,
    publicKinds: Array.from(publicKinds),
    source: '/v1/events',
    rule: 'Only public relay events may be signed or published as Nostr events. Private inbox posts and GRTAP proofs are never mirrored.'
  };
}

async function mirrorPolicyWithKey(config, publicKinds) {
  const policy = mirrorPolicy(config, publicKinds);
  if (!config.secretKey) return policy;
  const { getPublicKey } = await import('nostr-tools/pure');
  return { ...policy, publicKey: getPublicKey(hexToBytes(config.secretKey)) };
}

function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function publishNostrEvents(nostrEvents, relayUrls, timeoutMs = 7000) {
  const [{ Relay, useWebSocketImplementation }, wsModule] = await Promise.all([
    import('nostr-tools/relay'),
    import('ws')
  ]);
  useWebSocketImplementation(wsModule.default || wsModule.WebSocket || wsModule);

  const results = [];
  for (const relayUrl of relayUrls) {
    const relayResult = { relay: relayUrl, ok: false, events: [] };
    let relay = null;
    try {
      relay = await withTimeout(Relay.connect(relayUrl), timeoutMs, `connect timeout: ${relayUrl}`);
      for (const nostrEvent of nostrEvents) {
        try {
          await withTimeout(relay.publish(nostrEvent), timeoutMs, `publish timeout: ${relayUrl}`);
          relayResult.events.push({ id: nostrEvent.id, ok: true });
        } catch (err) {
          relayResult.events.push({ id: nostrEvent.id, ok: false, error: err.message });
        }
      }
      relayResult.ok = relayResult.events.every(item => item.ok);
    } catch (err) {
      relayResult.error = err.message;
    } finally {
      if (relay) relay.close();
    }
    results.push(relayResult);
  }
  return results;
}

module.exports = {
  buildNostrTemplate,
  mirrorPolicyWithKey,
  publishNostrEvents,
  readNostrConfig,
  signRelayEvent,
  signRelayEvents
};
