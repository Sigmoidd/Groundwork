const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  prepareBlindMessage,
  softHash,
} = require('../src/canopy');
const {
  buildNostrTemplate,
  readNostrConfig,
} = require('../src/nostr');

const repoRelayDir = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-relay-'));
const port = 19_000 + Math.floor(Math.random() * 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
const TEST_NOSTR_SECRET_KEY = `${'0'.repeat(63)}1`;

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: repoRelayDir,
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    CANOPY_SECRET: 'test-canopy-secret-at-least-thirty-two-bytes',
    CANOPY_MAX_ISSUABLE_THRESHOLD: 'keeper',
    CANOPY_ALLOW_ATTENDANCE_CREDIT: '1',
    NOSTR_MIRROR_SECRET_KEY: TEST_NOSTR_SECRET_KEY,
    NOSTR_MIRROR_SOURCE_URL: baseUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => {
  stdout += chunk.toString();
});
child.stderr.on('data', chunk => {
  stderr += chunk.toString();
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep text body for root endpoint checks.
  }
  return { response, body };
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8_000) {
    if (child.exitCode != null) {
      throw new Error(`relay exited early ${child.exitCode}\n${stdout}\n${stderr}`);
    }
    try {
      const { response, body } = await request('/health');
      if (response.ok && body?.ok) return body;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`relay did not start\n${stdout}\n${stderr}`);
}

async function main() {
  const health = await waitForServer();
  assert.strictEqual(health.relay, 'Groundwork Relay');
  assert.strictEqual(health.canopy.active, true);

  const publicEvent = {
    kind: 'resource_pin',
    author: 'smoke-device',
    createdAt: Date.now(),
    tile: 'okc:sector:Downtown',
    body: { resource: 'water', note: 'Smoke test fountain' },
  };
  const publicWrite = await request('/v1/events', {
    method: 'POST',
    body: JSON.stringify(publicEvent),
  });
  assert.strictEqual(publicWrite.response.status, 202);
  assert.strictEqual(publicWrite.body.ok, true);
  assert.strictEqual(publicWrite.body.stored[0].stored, true);

  const publicQuery = await request('/v1/events?kind=resource_pin&tile=okc:sector:Downtown');
  assert.strictEqual(publicQuery.response.status, 200);
  assert.strictEqual(publicQuery.body.events.length, 1);
  assert.strictEqual(publicQuery.body.events[0].body.note, 'Smoke test fountain');

  const dmEvent = {
    kind: 'dm',
    author: 'smoke-device',
    createdAt: Date.now(),
    recipient: 'cedar-fox',
    body: { topic: 'hello', body: 'private message' },
  };
  const dmWrite = await request('/v1/events', {
    method: 'POST',
    body: JSON.stringify(dmEvent),
  });
  assert.strictEqual(dmWrite.response.status, 202);
  const inbox = await request('/v1/inbox/cedar-fox');
  assert.strictEqual(inbox.response.status, 200);
  assert.strictEqual(inbox.body.events.length, 1);
  assert.strictEqual(inbox.body.events[0].scope, 'private');

  const privateGroupPin = {
    kind: 'resource_pin',
    author: 'smoke-device',
    createdAt: Date.now(),
    scope: 'private',
    recipient: 'crew-alpha',
    tile: 'okc:sector:Midtown',
    body: { resource: 'shade', note: 'Crew-only staging note' },
  };
  assert.throws(
    () => buildNostrTemplate(
      { ...privateGroupPin, id: softHash('private-group-pin') },
      readNostrConfig({ NOSTR_MIRROR_SECRET_KEY: TEST_NOSTR_SECRET_KEY }),
      new Set(['resource_pin'])
    ),
    /private relay events cannot be mirrored/
  );
  const privatePinWrite = await request('/v1/events', {
    method: 'POST',
    body: JSON.stringify(privateGroupPin),
  });
  assert.strictEqual(privatePinWrite.response.status, 202);
  assert.strictEqual(privatePinWrite.body.stored[0].lane.lane, 'private');
  assert.strictEqual(privatePinWrite.body.stored[0].lane.nostr, false);

  const publicOnlyEvenWithFlag = await request('/v1/events?includePrivate=true&recipient=crew-alpha&limit=500');
  assert.strictEqual(publicOnlyEvenWithFlag.response.status, 200);
  assert.strictEqual(publicOnlyEvenWithFlag.body.events.some(event => event.id === privatePinWrite.body.stored[0].id), false);

  const groupInbox = await request('/v1/inbox/crew-alpha?limit=500');
  assert.strictEqual(groupInbox.response.status, 200);
  assert.strictEqual(groupInbox.body.events.length, 1);
  assert.strictEqual(groupInbox.body.events[0].kind, 'resource_pin');

  const exportAttempt = await request('/v1/export.ndjson?includePrivate=true&limit=500');
  assert.strictEqual(exportAttempt.response.status, 200);
  assert.strictEqual(String(exportAttempt.body).includes('Crew-only staging note'), false);

  const policy = await request('/v1/transport/policy');
  assert.strictEqual(policy.response.status, 200);
  assert.strictEqual(policy.body.lanes.public.nostr, 'eligible for public Nostr-compatible mirroring');
  assert.strictEqual(policy.body.lanes.private.nostr, 'never mirrored to Nostr');

  const nostrPolicy = await request('/v1/nostr/policy');
  assert.strictEqual(nostrPolicy.response.status, 200);
  assert.strictEqual(nostrPolicy.body.mirror.configured, true);
  assert.strictEqual(nostrPolicy.body.mirror.enabled, false);
  assert.match(nostrPolicy.body.mirror.publicKey, /^[a-f0-9]{64}$/);
  assert.strictEqual(nostrPolicy.body.mirror.source, '/v1/events');

  const nostrEvents = await request('/v1/nostr/events?limit=500');
  assert.strictEqual(nostrEvents.response.status, 200);
  assert.strictEqual(nostrEvents.body.source, '/v1/events');
  assert.ok(Array.isArray(nostrEvents.body.events));
  assert.strictEqual(nostrEvents.body.events.some(event => event.content.includes('Crew-only staging note')), false);

  const mirroredPublic = nostrEvents.body.events.find(event => {
    try {
      return JSON.parse(event.content).source.relayEventId === publicWrite.body.stored[0].id;
    } catch {
      return false;
    }
  });
  assert.ok(mirroredPublic);
  assert.strictEqual(mirroredPublic.kind, 39701);
  assert.ok(mirroredPublic.tags.some(tag => tag[0] === 'd' && tag[1] === `groundwork:${publicWrite.body.stored[0].id}`));
  const { verifyEvent } = await import('nostr-tools/pure');
  assert.strictEqual(verifyEvent(mirroredPublic), true);

  const disabledPublish = await request('/v1/nostr/publish', {
    method: 'POST',
    body: JSON.stringify({ limit: 1 }),
  });
  assert.strictEqual(disabledPublish.response.status, 403);

  const legacyLeaf = await request('/v1/canopy/leaf', {
    method: 'POST',
    body: JSON.stringify({ capability: 'crew_join' }),
  });
  assert.strictEqual(legacyLeaf.response.status, 410);

  const seed = await request('/v1/canopy/seed');
  assert.strictEqual(seed.response.status, 200);
  assert.strictEqual(seed.body.seed.schema, 'grtap.blind.seed.v1');
  assert.ok(seed.body.seed.publicKeyPem.includes('BEGIN PUBLIC KEY'));

  const capabilityToken = {
    schema: 'grtap.blind.token.v1',
    kind: 'capability',
    capability: 'crew_join',
    thresholdClass: 'contributor',
    relayScopeHash: softHash('demo-private-relay'),
    actionScopeHash: softHash('cleanup-run-42'),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    tokenNonce: crypto.randomBytes(18).toString('base64url'),
    nullifier: crypto.randomBytes(24).toString('base64url'),
  };
  const preparedCapability = prepareBlindMessage(capabilityToken, seed.body.seed.modulusBytes);
  const shade = await request('/v1/canopy/shade', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'grtap.blind.issue.v1',
      keyId: seed.body.seed.keyId,
      suite: seed.body.seed.suite,
      blindedMsg: preparedCapability.toString('base64url'),
      request: capabilityToken,
    }),
  });
  assert.strictEqual(shade.response.status, 201);
  assert.strictEqual(shade.body.ok, true);
  assert.strictEqual(typeof shade.body.shade.blindSig, 'string');

  const holdBody = {
    token: capabilityToken,
    blindSig: shade.body.shade.blindSig,
    ask: {
      capability: 'crew_join',
      thresholdClass: 'contributor',
      relayScopeHash: softHash('demo-private-relay'),
      actionScopeHash: softHash('cleanup-run-42'),
    },
  };
  const mismatchHold = await request('/v1/canopy/hold', {
    method: 'POST',
    body: JSON.stringify({
      ...holdBody,
      ask: {
        ...holdBody.ask,
        actionScopeHash: softHash('other-action'),
      },
    }),
  });
  assert.strictEqual(mismatchHold.response.status, 400);
  const hold = await request('/v1/canopy/hold', {
    method: 'POST',
    body: JSON.stringify(holdBody),
  });
  assert.strictEqual(hold.response.status, 200);
  assert.strictEqual(hold.body.ok, true);
  const replayHold = await request('/v1/canopy/hold', {
    method: 'POST',
    body: JSON.stringify(holdBody),
  });
  assert.strictEqual(replayHold.response.status, 409);

  const attendanceToken = {
    schema: 'grtap.blind.token.v1',
    kind: 'attendance',
    attendanceClass: 'credit',
    eventCommitment: softHash('event:cleanup-run-42'),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    tokenNonce: crypto.randomBytes(18).toString('base64url'),
    nullifier: crypto.randomBytes(24).toString('base64url'),
  };
  const preparedAttendance = prepareBlindMessage(attendanceToken, seed.body.seed.modulusBytes);
  const lanternResponse = await request('/v1/lantern/glow', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'grtap.blind.issue.v1',
      keyId: seed.body.seed.keyId,
      suite: seed.body.seed.suite,
      blindedMsg: preparedAttendance.toString('base64url'),
      request: attendanceToken,
    }),
  });
  assert.strictEqual(lanternResponse.response.status, 201);
  assert.strictEqual(lanternResponse.body.ok, true);

  const markBody = {
    token: attendanceToken,
    blindSig: lanternResponse.body.glow.blindSig,
    ask: {
      attendanceClass: 'credit',
      eventCommitment: softHash('event:cleanup-run-42'),
    },
  };
  const mark = await request('/v1/lantern/mark', {
    method: 'POST',
    body: JSON.stringify(markBody),
  });
  assert.strictEqual(mark.response.status, 200);
  assert.strictEqual(mark.body.ok, true);
  const replayMark = await request('/v1/lantern/mark', {
    method: 'POST',
    body: JSON.stringify(markBody),
  });
  assert.strictEqual(replayMark.response.status, 409);

  const safetySignal = await request('/v1/canopy/signal', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'grtap.safety.signal.v1',
      tokenKind: 'capability',
      nullifierHash: softHash(capabilityToken.nullifier),
      signalClass: 'serious_safety_concern',
      observedAtBucket: new Date().toISOString().slice(0, 10),
      reportNonce: crypto.randomBytes(18).toString('base64url'),
    }),
  });
  assert.strictEqual(safetySignal.response.status, 202);
  assert.strictEqual(safetySignal.body.ok, true);

  const detailedSignal = await request('/v1/canopy/signal', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'grtap.safety.signal.v1',
      tokenKind: 'capability',
      nullifierHash: softHash(capabilityToken.nullifier),
      signalClass: 'serious_safety_concern',
      observedAtBucket: new Date().toISOString().slice(0, 10),
      reportNonce: crypto.randomBytes(18).toString('base64url'),
      privateRelayName: 'should not be accepted',
    }),
  });
  assert.strictEqual(detailedSignal.response.status, 400);
}

main()
  .finally(() => {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  })
  .then(() => {
    console.log('relay smoke tests passed');
  })
  .catch(error => {
    console.error(error);
    console.error(stdout);
    console.error(stderr);
    process.exit(1);
  });
