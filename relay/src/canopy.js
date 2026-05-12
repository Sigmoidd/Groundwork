const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_LEAF_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LANTERN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const THRESHOLD_ORDER = ['public', 'contributor', 'established', 'trusted', 'keeper'];
const KNOWN_CAPABILITIES = new Set([
  'map_confirm',
  'crew_join',
  'crew_chat',
  'dm_request',
  'invite_member',
  'create_event',
  'join_organizing_party',
  'private_relay_access',
  'vouch',
  'stewardship_reward_claim',
  'attendance_credit_claim'
]);
const KNOWN_ATTENDANCE = new Set(['count', 'credit', 'occurrence']);

function softHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeText(value, fallback = '') {
  return String(value == null ? fallback : value).trim();
}

function safeClass(value, allowed, fallback) {
  const picked = safeText(value, fallback);
  return allowed.has(picked) ? picked : fallback;
}

function safeThreshold(value) {
  const picked = safeText(value, 'public');
  return THRESHOLD_ORDER.includes(picked) ? picked : 'public';
}

function stableShape(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableShape).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableShape(value[key])}`).join(',')}}`;
}

function sealShape(secret, value) {
  return crypto.createHmac('sha256', secret).update(stableShape(value)).digest('base64url');
}

function gardenSecret() {
  const configured = process.env.CANOPY_SECRET || process.env.RELAY_SECRET;
  if (configured && configured.length >= 32) {
    return configured;
  }
  return 'groundwork-local-canopy-dev-secret-change-before-deploy';
}

function nowMs() {
  return Date.now();
}

function makeLeaf(input, options = {}) {
  const issuedAt = nowMs();
  const expiresAt = Number(input.expiresAt || issuedAt + (options.ttlMs || DEFAULT_LEAF_TTL_MS));
  const leaf = {
    v: 1,
    kind: 'canopy.leaf',
    capability: safeClass(input.capability, KNOWN_CAPABILITIES, 'crew_join'),
    thresholdClass: safeThreshold(input.thresholdClass),
    relayScope: softHash(safeText(input.relayScope, 'local')),
    actionScope: input.actionScope ? softHash(input.actionScope) : '',
    issuedAt,
    expiresAt,
    tokenNonce: crypto.randomBytes(18).toString('base64url'),
    nullifier: crypto.randomBytes(24).toString('base64url')
  };
  leaf.seal = sealShape(options.secret || gardenSecret(), leaf);
  return leaf;
}

function readLeaf(leaf, options = {}) {
  if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf)) {
    return { ok: false, error: 'leaf must be an object' };
  }
  const seal = safeText(leaf.seal);
  if (!seal) {
    return { ok: false, error: 'leaf seal missing' };
  }
  const copy = { ...leaf };
  delete copy.seal;
  const expected = sealShape(options.secret || gardenSecret(), copy);
  const given = Buffer.from(seal);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return { ok: false, error: 'leaf seal invalid' };
  }
  if (Number(copy.expiresAt) < nowMs()) {
    return { ok: false, error: 'leaf expired' };
  }
  if (!KNOWN_CAPABILITIES.has(copy.capability)) {
    return { ok: false, error: 'leaf capability unknown' };
  }
  return { ok: true, leaf: copy };
}

function fitsBranch(leaf, ask = {}) {
  if (ask.capability && leaf.capability !== ask.capability) {
    return { ok: false, error: 'capability mismatch' };
  }
  if (ask.relayScope && leaf.relayScope !== softHash(ask.relayScope)) {
    return { ok: false, error: 'relay scope mismatch' };
  }
  if (ask.actionScope && leaf.actionScope !== softHash(ask.actionScope)) {
    return { ok: false, error: 'action scope mismatch' };
  }
  if (ask.thresholdClass) {
    const actual = THRESHOLD_ORDER.indexOf(leaf.thresholdClass);
    const needed = THRESHOLD_ORDER.indexOf(safeThreshold(ask.thresholdClass));
    if (actual < needed) {
      return { ok: false, error: 'threshold class mismatch' };
    }
  }
  return { ok: true };
}

function stoneKey(kind, nullifier) {
  return softHash(`${kind}:${nullifier}`);
}

function b64uToBuf(value) {
  const text = safeText(value);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new Error('invalid base64url');
  }
  return Buffer.from(text, 'base64url');
}

function bufToB64u(value) {
  return Buffer.from(value).toString('base64url');
}

function openCanopy(dataDir) {
  const keyPath = path.join(dataDir, 'canopy-issuer.pem');
  let privateKeyPem = '';
  if (fs.existsSync(keyPath)) {
    privateKeyPem = fs.readFileSync(keyPath, 'utf8');
  } else {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicExponent: 0x10001,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    privateKeyPem = pair.privateKey;
    fs.writeFileSync(keyPath, privateKeyPem, { mode: 0o600 });
  }

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const keyId = softHash(publicKeyPem).slice(0, 32);
  const modulusBytes = Math.ceil((publicKey.asymmetricKeyDetails.modulusLength || 3072) / 8);

  return {
    keyId,
    suite: 'RSABSSA-SHA384-PSS-Randomized',
    publicKeyPem,
    publicJwk,
    modulusBytes,
    privateKey
  };
}

function readBundle(input, garden) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'bundle must be an object' };
  }
  const schema = safeText(input.schema, 'grtap.blind.issue.v1');
  if (schema !== 'grtap.blind.issue.v1') {
    return { ok: false, error: 'unsupported bundle schema' };
  }
  if (safeText(input.keyId) !== garden.keyId) {
    return { ok: false, error: 'unknown canopy seed' };
  }
  if (safeText(input.suite) !== garden.suite) {
    return { ok: false, error: 'unsupported canopy suite' };
  }
  let blinded;
  try {
    blinded = b64uToBuf(input.blindedMsg);
  } catch {
    return { ok: false, error: 'invalid blinded message' };
  }
  if (blinded.length !== garden.modulusBytes) {
    return { ok: false, error: 'unexpected blinded message size' };
  }
  const request = input.request && typeof input.request === 'object' ? input.request : {};
  const capability = safeClass(request.capability, KNOWN_CAPABILITIES, 'crew_join');
  const thresholdClass = safeThreshold(request.thresholdClass);
  const relayScopeHash = safeText(request.relayScopeHash);
  const actionScopeHash = safeText(request.actionScopeHash);
  const requestNonce = safeText(request.requestNonce);
  const expiresAt = Number(request.expiresAt || Date.now() + DEFAULT_LEAF_TTL_MS);
  if (!relayScopeHash || relayScopeHash.length > 128) {
    return { ok: false, error: 'relay scope hash required' };
  }
  if (actionScopeHash.length > 128 || requestNonce.length > 128) {
    return { ok: false, error: 'request field too large' };
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { ok: false, error: 'expiresAt must be in the future' };
  }
  return {
    ok: true,
    bundle: {
      schema,
      keyId: garden.keyId,
      suite: garden.suite,
      blinded,
      request: {
        capability,
        thresholdClass,
        relayScopeHash,
        actionScopeHash,
        requestNonce,
        expiresAt
      }
    }
  };
}

function castShade(garden, blinded) {
  let shade;
  try {
    shade = crypto.privateDecrypt(
      {
        key: garden.privateKey,
        padding: crypto.constants.RSA_NO_PADDING
      },
      blinded
    );
  } catch {
    throw new Error('shade failed');
  }

  let check;
  try {
    check = crypto.publicEncrypt(
      {
        key: garden.publicKeyPem,
        padding: crypto.constants.RSA_NO_PADDING
      },
      shade
    );
  } catch {
    throw new Error('shade check failed');
  }
  if (check.length !== blinded.length || !crypto.timingSafeEqual(check, blinded)) {
    throw new Error('shade check failed');
  }
  return bufToB64u(shade);
}

function makeLantern(input, options = {}) {
  const issuedAt = nowMs();
  const expiresAt = Number(input.expiresAt || issuedAt + (options.ttlMs || DEFAULT_LANTERN_TTL_MS));
  const eventCommitment = input.eventCommitment
    ? softHash(input.eventCommitment)
    : softHash(`${safeText(input.eventTimeBucket, issuedAt)}:${safeText(input.eventTypeClass, 'event')}:${crypto.randomBytes(12).toString('base64url')}`);
  const glow = {
    v: 1,
    kind: 'canopy.lantern',
    attendanceClass: safeClass(input.attendanceClass, KNOWN_ATTENDANCE, 'count'),
    eventCommitment,
    issuedAt,
    expiresAt,
    tokenNonce: crypto.randomBytes(18).toString('base64url'),
    nullifier: crypto.randomBytes(24).toString('base64url')
  };
  glow.seal = sealShape(options.secret || gardenSecret(), glow);
  return glow;
}

function readLantern(glow, options = {}) {
  if (!glow || typeof glow !== 'object' || Array.isArray(glow)) {
    return { ok: false, error: 'lantern must be an object' };
  }
  const seal = safeText(glow.seal);
  if (!seal) {
    return { ok: false, error: 'lantern seal missing' };
  }
  const copy = { ...glow };
  delete copy.seal;
  const expected = sealShape(options.secret || gardenSecret(), copy);
  const given = Buffer.from(seal);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return { ok: false, error: 'lantern seal invalid' };
  }
  if (Number(copy.expiresAt) < nowMs()) {
    return { ok: false, error: 'lantern expired' };
  }
  if (!KNOWN_ATTENDANCE.has(copy.attendanceClass)) {
    return { ok: false, error: 'lantern class unknown' };
  }
  return { ok: true, lantern: copy };
}

function fitsLantern(glow, ask = {}) {
  if (ask.attendanceClass && glow.attendanceClass !== ask.attendanceClass) {
    return { ok: false, error: 'attendance class mismatch' };
  }
  if (ask.eventCommitment && glow.eventCommitment !== softHash(ask.eventCommitment)) {
    return { ok: false, error: 'event commitment mismatch' };
  }
  return { ok: true };
}

module.exports = {
  KNOWN_CAPABILITIES,
  KNOWN_ATTENDANCE,
  THRESHOLD_ORDER,
  castShade,
  fitsBranch,
  fitsLantern,
  makeLantern,
  makeLeaf,
  openCanopy,
  readBundle,
  readLantern,
  readLeaf,
  softHash,
  stoneKey
};
