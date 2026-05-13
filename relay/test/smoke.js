const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRelayDir = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-relay-'));
const port = 19_000 + Math.floor(Math.random() * 10_000);
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: repoRelayDir,
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    CANOPY_SECRET: 'test-canopy-secret-at-least-thirty-two-bytes',
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

  const leafResponse = await request('/v1/canopy/leaf', {
    method: 'POST',
    body: JSON.stringify({
      capability: 'crew_join',
      thresholdClass: 'contributor',
      relayScope: 'demo-private-relay',
      actionScope: 'cleanup-run-42',
    }),
  });
  assert.strictEqual(leafResponse.response.status, 201);
  assert.strictEqual(leafResponse.body.ok, true);

  const holdBody = {
    leaf: leafResponse.body.leaf,
    ask: {
      capability: 'crew_join',
      thresholdClass: 'public',
      relayScope: 'demo-private-relay',
      actionScope: 'cleanup-run-42',
    },
  };
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

  const lanternResponse = await request('/v1/lantern/glow', {
    method: 'POST',
    body: JSON.stringify({
      attendanceClass: 'credit',
      eventCommitment: 'event:cleanup-run-42',
    }),
  });
  assert.strictEqual(lanternResponse.response.status, 201);
  assert.strictEqual(lanternResponse.body.ok, true);

  const markBody = {
    lantern: lanternResponse.body.lantern,
    ask: {
      attendanceClass: 'credit',
      eventCommitment: 'event:cleanup-run-42',
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

  const seed = await request('/v1/canopy/seed');
  assert.strictEqual(seed.response.status, 200);
  assert.strictEqual(seed.body.seed.schema, 'grtap.blind.seed.v1');
  assert.ok(seed.body.seed.publicKeyPem.includes('BEGIN PUBLIC KEY'));

  const preparedMsg = Buffer.alloc(seed.body.seed.modulusBytes);
  crypto.randomFillSync(preparedMsg, 1);
  const blindedMsg = crypto.publicEncrypt(
    {
      key: seed.body.seed.publicKeyPem,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    preparedMsg,
  ).toString('base64url');
  const shade = await request('/v1/canopy/shade', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'grtap.blind.issue.v1',
      keyId: seed.body.seed.keyId,
      suite: seed.body.seed.suite,
      blindedMsg,
      request: {
        capability: 'crew_join',
        thresholdClass: 'contributor',
        relayScopeHash: crypto.createHash('sha256').update('demo-private-relay').digest('hex'),
        actionScopeHash: crypto.createHash('sha256').update('cleanup-run-42').digest('hex'),
        requestNonce: crypto.randomBytes(12).toString('base64url'),
        expiresAt: Date.now() + 60_000,
      },
    }),
  });
  assert.strictEqual(shade.response.status, 201);
  assert.strictEqual(shade.body.ok, true);
  assert.strictEqual(typeof shade.body.shade.blindSig, 'string');
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
