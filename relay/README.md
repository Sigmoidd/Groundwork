# Groundwork Relay Starter

A tiny append-only relay for **Groundwork OKC**.

This freezes the backend feature set to four event kinds:

- `resource_pin`
- `job_posted`
- `dm`
- `planting_request`

The relay is intentionally small:

- **Node only**
- **no external database server**
- append-only `events.ndjson` file on disk
- HTTP API for polling
- SSE stream for live updates
- easy to run on a $5 VPS, mini PC, or community box

## Why this shape

The client keeps the working log locally first. The relay is just a mailbox and cache.
It does not derive global truth, it does not need Postgres, and it does not need blockchain machinery.

## Where posts go

Groundwork uses open Nostr-compatible event transport for public and
verifiable civic data, and GRTAP for anonymous capability and safety proofs.
The relay keeps those lanes separate:

| Lane | What belongs there | Write | Read | Nostr |
| --- | --- | --- | --- | --- |
| Public | Public resource pins, confirmations, public events, jobs, public planner requests | `POST /v1/events` with `scope: "public"` | `GET /v1/events`, `GET /v1/stream`, `GET /v1/export.ndjson` | Eligible for public mirroring |
| Private | Group pins, DMs, private crew notes | `POST /v1/events` with `scope: "private"` and `recipient` | `GET /v1/inbox/:recipient` only | Never mirrored |
| Proof | Capability tokens, attendance tokens, safety signals | `/v1/canopy/*`, `/v1/lantern/*` | Seed metadata only | Never mirrored |

Plain rule: public posts are for the open map. Private posts are for a
specific inbox. Proofs are not posts.

## Quick start

```bash
npm install
npm start
```

Run the relay smoke suite before deploying changes:

```bash
npm test
```

The smoke suite starts the relay on a random local port with a temporary data
directory, then verifies event sync, private inbox reads, GRTAP canopy
leaf/hold replay protection, lantern attendance replay protection, and the
blind seed/shade endpoints.

Default port: `8787`

Health check:

```bash
curl http://localhost:8787/health
```

## Environment variables

```bash
PORT=8787
DATA_DIR=./data
CORS_ORIGIN=https://groundworkokc.org
RELAY_NAME=Groundwork Relay OKC
MAX_BODY_BYTES=262144
MAX_EVENT_BODY_BYTES=131072
CANOPY_SECRET=change-this-to-at-least-32-random-bytes-before-deploy
```

## Event shape

Every event is a single JSON object.

```json
{
  "id": "sha256-of-canonical-event",
  "kind": "resource_pin",
  "author": "oak-wren-41",
  "createdAt": 1778160000000,
  "scope": "public",
  "tile": "okc:z15:35.472:-97.521",
  "recipient": "",
  "expiresAt": null,
  "body": {
    "resource": "water",
    "label": "Drinking fountain by west entrance",
    "lat": 35.472,
    "lng": -97.521,
    "note": "Works as of today"
  },
  "sig": "optional client signature"
}
```

Notes:

- `dm` events always become `scope: "private"` and must set `recipient`
- `resource_pin`, `job_posted`, and `planting_request` are public unless sent
  with `scope: "private"` and a `recipient`
- `id` can be omitted on write; the relay will compute it
- `sig` is stored but not cryptographically verified yet
- Private events are not returned from `/v1/events`, even if a caller passes
  `includePrivate=true`

## API

### `GET /health`

Returns relay status.

### `GET /v1/events`

Query public events.

Supported query params:

- `kind`
- `tile`
- `author`
- `recipient`
- `scope`
- `since`
- `until`
- `limit`
- `includeExpired=true`

Example:

```bash
curl "http://localhost:8787/v1/events?kind=resource_pin&tile=okc:z15:35.472:-97.521"
```

### `POST /v1/events`

Store one event or a batch.

```bash
curl -X POST http://localhost:8787/v1/events \
  -H 'content-type: application/json' \
  -d '{
    "kind":"resource_pin",
    "author":"oak-wren-41",
    "tile":"okc:z15:35.472:-97.521",
    "body":{
      "resource":"water",
      "label":"Library fountain",
      "lat":35.472,
      "lng":-97.521,
      "note":"Public fountain"
    }
  }'
```

### `GET /v1/inbox/:recipient`

Pull private posts for one recipient. This is the only read path for DMs,
group-scoped pins, and private crew notes.

```bash
curl "http://localhost:8787/v1/inbox/cedar-fox-12?since=1778160000000"
```

### `GET /v1/transport/policy`

Returns the public/private/proof lane rules clients should display and enforce.

```bash
curl http://localhost:8787/v1/transport/policy
```

### `GET /v1/stream`

Server-sent events stream for live relay updates.

Example:

```bash
curl -N "http://localhost:8787/v1/stream?kind=resource_pin&tile=okc:z15:35.472:-97.521"
```

### `GET /v1/export.ndjson`

Exports matching events as newline-delimited JSON.
Private posts are never included in this export.

## Canopy capability endpoints

The v0.2 relay prototype adds a small capability layer. The public endpoint
naming is intentionally neutral:

- a `leaf` is a scoped, signed, short-lived capability token
- `hold` verifies and spends a leaf
- a `lantern` is a scoped attendance credential
- a `stone` is a spent nullifier used for replay protection
- a `seed` is the public issuer key and suite metadata
- `shade` returns a blind response for a client-blinded request

The preferred v0.2 flow follows the RFC 9474 RSA blind signature shape:
`Prepare`, `Blind`, `BlindSign`, and `Finalize`, using the
`RSABSSA-SHA384-PSS-Randomized` suite. The relay performs only the server-side
operation: it validates the visible request envelope and returns a blind
response over the client-supplied blinded message. The client is responsible for
preparing, blinding, finalizing, and verifying the final signature.

The older `leaf` endpoint remains as a local HMAC-sealed prototype for clients
that have not implemented the blind flow yet.

### `GET /v1/canopy/seed`

Fetch the public issuer key and suite metadata.

```bash
curl http://localhost:8787/v1/canopy/seed
```

Returns:

```json
{
  "ok": true,
  "seed": {
    "schema": "grtap.blind.seed.v1",
    "keyId": "issuer-key-id",
    "suite": "RSABSSA-SHA384-PSS-Randomized",
    "modulusBytes": 384,
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----...",
    "publicJwk": {
      "kty": "RSA",
      "n": "...",
      "e": "AQAB"
    }
  }
}
```

### `POST /v1/canopy/shade`

Submit a blinded message and receive a blind response.

```json
{
  "schema": "grtap.blind.issue.v1",
  "keyId": "issuer-key-id",
  "suite": "RSABSSA-SHA384-PSS-Randomized",
  "blindedMsg": "base64url-modulus-sized-client-blinded-message",
  "request": {
    "capability": "crew_join",
    "thresholdClass": "contributor",
    "relayScopeHash": "sha256-relay-scope",
    "actionScopeHash": "optional-sha256-action-scope",
    "requestNonce": "client-random",
    "expiresAt": 1778160000000
  }
}
```

Returns:

```json
{
  "ok": true,
  "shade": {
    "schema": "grtap.blind.response.v1",
    "keyId": "issuer-key-id",
    "suite": "RSABSSA-SHA384-PSS-Randomized",
    "blindSig": "base64url-modulus-sized-blind-response",
    "issuedAt": 1778159900000,
    "requestEcho": {
      "capability": "crew_join",
      "thresholdClass": "contributor",
      "relayScopeHash": "sha256-relay-scope",
      "actionScopeHash": "optional-sha256-action-scope",
      "requestNonce": "client-random",
      "expiresAt": 1778160000000
    }
  }
}
```

Safety note:

The main relay signs without seeing the final token. That protects privacy.

Because of that, the private relay must check the token when it is used:

- Is it for this action?
- Is it for this relay?
- Is it for this event or task?
- Is it still fresh?
- Has it already been used?

If any answer is no, reject it.

### `POST /v1/canopy/leaf`

Mint a scoped capability leaf using the legacy HMAC prototype.

```bash
curl -X POST http://localhost:8787/v1/canopy/leaf \
  -H 'content-type: application/json' \
  -d '{
    "capability": "crew_join",
    "thresholdClass": "contributor",
    "relayScope": "demo-private-relay",
    "actionScope": "cleanup-run-42"
  }'
```

Returns:

```json
{
  "ok": true,
  "leaf": {
    "kind": "canopy.leaf",
    "capability": "crew_join",
    "thresholdClass": "contributor",
    "relayScope": "hash",
    "actionScope": "hash",
    "expiresAt": 1778160000000,
    "nullifier": "one-use-value",
    "seal": "server-seal"
  }
}
```

### `POST /v1/canopy/hold`

Verify and spend a leaf. The same leaf cannot be held twice.

```bash
curl -X POST http://localhost:8787/v1/canopy/hold \
  -H 'content-type: application/json' \
  -d '{
    "leaf": { "...": "leaf from /v1/canopy/leaf" },
    "ask": {
      "capability": "crew_join",
      "thresholdClass": "contributor",
      "relayScope": "demo-private-relay",
      "actionScope": "cleanup-run-42"
    }
  }'
```

### `POST /v1/lantern/glow`

Mint a scoped attendance credential.

```bash
curl -X POST http://localhost:8787/v1/lantern/glow \
  -H 'content-type: application/json' \
  -d '{
    "attendanceClass": "credit",
    "eventTimeBucket": "2026-05-11T21",
    "eventTypeClass": "public_stewardship"
  }'
```

### `POST /v1/lantern/mark`

Verify and spend an attendance credential. The relay stores only the spent
nullifier and coarse credential metadata needed for replay protection.

## Feature freeze payload examples

### `resource_pin`

```json
{
  "kind": "resource_pin",
  "author": "oak-wren-41",
  "tile": "okc:z15:35.472:-97.521",
  "body": {
    "resource": "outlet",
    "label": "Outdoor outlet by pavilion",
    "lat": 35.472,
    "lng": -97.521,
    "access": "public",
    "note": "Tested at 8:14pm",
    "photo": "optional-url-or-data"
  }
}
```

### `job_posted`

```json
{
  "kind": "job_posted",
  "author": "oak-wren-41",
  "tile": "okc:z15:35.471:-97.518",
  "body": {
    "service": "native planting",
    "sentence": "Need help planting a small pollinator strip.",
    "price": 80,
    "photo": "optional-url-or-data"
  }
}
```

### `dm`

```json
{
  "kind": "dm",
  "author": "oak-wren-41",
  "recipient": "cedar-fox-12",
  "scope": "private",
  "body": {
    "topic": "resource follow-up",
    "ciphertext": "opaque encrypted blob"
  }
}
```

### `planting_request`

```json
{
  "kind": "planting_request",
  "author": "oak-wren-41",
  "tile": "okc:z15:35.470:-97.520",
  "body": {
    "goal": "germinate and plant",
    "species": ["serviceberry", "echinacea"],
    "sun": "part sun",
    "water": "low once established",
    "notes": "Prefer stacked functions and perennial support species"
  }
}
```

## Running behind Caddy

A sample Caddyfile is included in `deploy/Caddyfile`.

## Running as a systemd service

A sample service unit is included in `deploy/groundwork-relay.service`.

## Suggested first frontend wiring

1. POST local events to `/v1/events` in the background
2. Poll `/v1/events?kind=resource_pin` on page load
3. Use `EventSource` against `/v1/stream?kind=resource_pin` for live map updates
4. Poll `/v1/inbox/:recipient` for inbox until you wire SSE for DMs

## What this relay does not do

- account creation
- key management
- auth dashboard
- moderation UI
- binary file storage
- full text search
- conflict resolution beyond append-only storage

That is deliberate. Keep the backend dumb.
