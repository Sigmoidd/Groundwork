const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_LEAF_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LANTERN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CAPABILITY_TTL_MS = Number(process.env.CANOPY_MAX_CAPABILITY_TTL_MS || DEFAULT_LEAF_TTL_MS);
const MAX_ATTENDANCE_TTL_MS = Number(process.env.CANOPY_MAX_ATTENDANCE_TTL_MS || DEFAULT_LANTERN_TTL_MS);
const BLIND_SUITE = 'GRTAP-RSA-BLIND-SHA384-V1';
const BLIND_TOKEN_SCHEMA = 'grtap.blind.token.v1';
const BLIND_ISSUE_SCHEMA = 'grtap.blind.issue.v1';
const CAPABILITY_TOKEN_FIELDS = [
  'schema',
  'kind',
  'capability',
  'thresholdClass',
  'relayScopeHash',
  'actionScopeHash',
  'issuedAt',
  'expiresAt',
  'tokenNonce',
  'nullifier'
];
const ATTENDANCE_TOKEN_FIELDS = [
  'schema',
  'kind',
  'attendanceClass',
  'eventCommitment',
  'issuedAt',
  'expiresAt',
  'tokenNonce',
  'nullifier'
];
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
const CAPABILITY_MIN_THRESHOLD = {
  map_confirm: 'public',
  crew_join: 'public',
  crew_chat: 'contributor',
  dm_request: 'contributor',
  invite_member: 'established',
  create_event: 'contributor',
  join_organizing_party: 'trusted',
  private_relay_access: 'trusted',
  vouch: 'keeper',
  stewardship_reward_claim: 'contributor',
  attendance_credit_claim: 'contributor'
};
const HASH_RE = /^[a-f0-9]{64}$/i;
const NONCE_RE = /^[A-Za-z0-9_-]{16,160}$/;

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

function visibleThreshold(value) {
  const picked = safeText(value);
  if (!THRESHOLD_ORDER.includes(picked)) {
    throw new Error('thresholdClass unknown');
  }
  return picked;
}

function thresholdRank(value) {
  return THRESHOLD_ORDER.indexOf(safeThreshold(value));
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
  if (process.env.NODE_ENV === 'production' || process.env.CANOPY_REQUIRE_SECRET === '1') {
    throw new Error('CANOPY_SECRET must be set');
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

function exactKeys(input, allowedKeys) {
  const actual = Object.keys(input || {}).sort();
  const allowed = [...allowedKeys].sort();
  if (actual.length !== allowed.length) {
    return false;
  }
  return actual.every((key, index) => key === allowed[index]);
}

function visibleHash(value, label) {
  const text = safeText(value);
  if (!HASH_RE.test(text)) {
    throw new Error(`${label} must be a sha256 hex hash`);
  }
  return text.toLowerCase();
}

function visibleNonce(value, label) {
  const text = safeText(value);
  if (!NONCE_RE.test(text)) {
    throw new Error(`${label} must be a base64url nonce`);
  }
  return text;
}

function visibleTimeWindow(issuedAtValue, expiresAtValue, maxTtlMs) {
  const issuedAt = Number(issuedAtValue);
  const expiresAt = Number(expiresAtValue);
  const now = nowMs();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    throw new Error('issuedAt and expiresAt are required');
  }
  if (issuedAt > now + 60_000) {
    throw new Error('issuedAt is too far in the future');
  }
  if (expiresAt <= now) {
    throw new Error('token expired');
  }
  if (expiresAt <= issuedAt) {
    throw new Error('expiresAt must be after issuedAt');
  }
  if (expiresAt - issuedAt > maxTtlMs) {
    throw new Error('token ttl too long');
  }
  return { issuedAt, expiresAt };
}

function readCapabilityToken(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'token must be an object' };
  }
  try {
    if (!exactKeys(input, CAPABILITY_TOKEN_FIELDS)) {
      throw new Error('capability token fields do not match schema');
    }
    if (safeText(input.schema) !== BLIND_TOKEN_SCHEMA) {
      throw new Error('unsupported token schema');
    }
    if (safeText(input.kind) !== 'capability') {
      throw new Error('token kind must be capability');
    }
    const capability = safeClass(input.capability, KNOWN_CAPABILITIES, '');
    if (!capability) {
      throw new Error('capability unknown');
    }
    const thresholdClass = visibleThreshold(input.thresholdClass);
    const relayScopeHash = visibleHash(input.relayScopeHash, 'relayScopeHash');
    const actionScopeHash = visibleHash(input.actionScopeHash, 'actionScopeHash');
    const { issuedAt, expiresAt } = visibleTimeWindow(input.issuedAt, input.expiresAt, MAX_CAPABILITY_TTL_MS);
    return {
      ok: true,
      token: {
        schema: BLIND_TOKEN_SCHEMA,
        kind: 'capability',
        capability,
        thresholdClass,
        relayScopeHash,
        actionScopeHash,
        issuedAt,
        expiresAt,
        tokenNonce: visibleNonce(input.tokenNonce, 'tokenNonce'),
        nullifier: visibleNonce(input.nullifier, 'nullifier')
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function readAttendanceToken(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'token must be an object' };
  }
  try {
    if (!exactKeys(input, ATTENDANCE_TOKEN_FIELDS)) {
      throw new Error('attendance token fields do not match schema');
    }
    if (safeText(input.schema) !== BLIND_TOKEN_SCHEMA) {
      throw new Error('unsupported token schema');
    }
    if (safeText(input.kind) !== 'attendance') {
      throw new Error('token kind must be attendance');
    }
    const attendanceClass = safeClass(input.attendanceClass, KNOWN_ATTENDANCE, '');
    if (!attendanceClass) {
      throw new Error('attendance class unknown');
    }
    const { issuedAt, expiresAt } = visibleTimeWindow(input.issuedAt, input.expiresAt, MAX_ATTENDANCE_TTL_MS);
    return {
      ok: true,
      token: {
        schema: BLIND_TOKEN_SCHEMA,
        kind: 'attendance',
        attendanceClass,
        eventCommitment: visibleHash(input.eventCommitment, 'eventCommitment'),
        issuedAt,
        expiresAt,
        tokenNonce: visibleNonce(input.tokenNonce, 'tokenNonce'),
        nullifier: visibleNonce(input.nullifier, 'nullifier')
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function readBlindToken(input) {
  const kind = safeText(input?.kind);
  if (kind === 'capability') {
    return readCapabilityToken(input);
  }
  if (kind === 'attendance') {
    return readAttendanceToken(input);
  }
  return { ok: false, error: 'unsupported token kind' };
}

function prepareBlindMessage(token, modulusBytes) {
  const checked = readBlindToken(token);
  if (!checked.ok) {
    throw new Error(checked.error);
  }
  const digest = crypto
    .createHash('sha384')
    .update(`GRTAP:${BLIND_TOKEN_SCHEMA}:${stableShape(checked.token)}`)
    .digest();
  const prefix = Buffer.from('GRTAP-BLIND-TOKEN-V1\0', 'utf8');
  if (modulusBytes < prefix.length + digest.length + 2) {
    throw new Error('modulus too small');
  }
  const prepared = Buffer.alloc(modulusBytes, 0);
  prepared[0] = 0;
  prepared[1] = 1;
  prefix.copy(prepared, 2);
  digest.copy(prepared, modulusBytes - digest.length);
  return prepared;
}

function verifyBlindToken(token, blindSig, garden) {
  const checked = readBlindToken(token);
  if (!checked.ok) {
    return checked;
  }
  let signature = null;
  try {
    signature = b64uToBuf(blindSig);
  } catch {
    return { ok: false, error: 'invalid blind signature' };
  }
  if (signature.length !== garden.modulusBytes) {
    return { ok: false, error: 'unexpected blind signature size' };
  }
  let opened = null;
  try {
    opened = crypto.publicEncrypt(
      {
        key: garden.publicKeyPem,
        padding: crypto.constants.RSA_NO_PADDING
      },
      signature
    );
  } catch {
    return { ok: false, error: 'blind signature verification failed' };
  }
  const prepared = prepareBlindMessage(checked.token, garden.modulusBytes);
  if (opened.length !== prepared.length || !crypto.timingSafeEqual(opened, prepared)) {
    return { ok: false, error: 'blind signature does not match revealed token fields' };
  }
  return { ok: true, token: checked.token };
}

function askHash(ask, hashField, rawField, required = true) {
  if (!ask || typeof ask !== 'object' || Array.isArray(ask)) {
    throw new Error('ask envelope required');
  }
  if (ask[hashField]) {
    return visibleHash(ask[hashField], hashField);
  }
  if (ask[rawField]) {
    return softHash(ask[rawField]);
  }
  if (required) {
    throw new Error(`${hashField} required`);
  }
  return '';
}

function fitsStrictCapabilityAsk(token, ask = {}) {
  try {
    if (!ask || typeof ask !== 'object' || Array.isArray(ask)) {
      throw new Error('ask envelope required');
    }
    if (!ask.capability || token.capability !== safeText(ask.capability)) {
      throw new Error('capability mismatch');
    }
    if (!ask.thresholdClass) {
      throw new Error('thresholdClass required');
    }
    const needed = visibleThreshold(ask.thresholdClass);
    if (thresholdRank(token.thresholdClass) < thresholdRank(needed)) {
      throw new Error('threshold class mismatch');
    }
    if (token.relayScopeHash !== askHash(ask, 'relayScopeHash', 'relayScope')) {
      throw new Error('relay scope mismatch');
    }
    if (token.actionScopeHash !== askHash(ask, 'actionScopeHash', 'actionScope')) {
      throw new Error('action scope mismatch');
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function fitsStrictAttendanceAsk(token, ask = {}) {
  try {
    if (!ask || typeof ask !== 'object' || Array.isArray(ask)) {
      throw new Error('ask envelope required');
    }
    if (!ask.attendanceClass || token.attendanceClass !== safeText(ask.attendanceClass)) {
      throw new Error('attendance class mismatch');
    }
    if (token.eventCommitment !== askHash(ask, 'eventCommitment', 'eventCommitmentRaw')) {
      throw new Error('event commitment mismatch');
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
    suite: BLIND_SUITE,
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
  const schema = safeText(input.schema, BLIND_ISSUE_SCHEMA);
  if (schema !== BLIND_ISSUE_SCHEMA) {
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
  const checkedToken = readBlindToken(request);
  if (!checkedToken.ok) {
    return checkedToken;
  }
  return {
    ok: true,
    bundle: {
      schema,
      keyId: garden.keyId,
      suite: garden.suite,
      blinded,
      request: checkedToken.token
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
  CAPABILITY_MIN_THRESHOLD,
  CAPABILITY_TOKEN_FIELDS,
  ATTENDANCE_TOKEN_FIELDS,
  BLIND_TOKEN_SCHEMA,
  BLIND_ISSUE_SCHEMA,
  THRESHOLD_ORDER,
  castShade,
  fitsBranch,
  fitsLantern,
  fitsStrictAttendanceAsk,
  fitsStrictCapabilityAsk,
  makeLantern,
  makeLeaf,
  openCanopy,
  prepareBlindMessage,
  readBundle,
  readBlindToken,
  readLantern,
  readLeaf,
  thresholdRank,
  verifyBlindToken,
  softHash,
  stoneKey
};
