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

## Quick start

```bash
npm install
npm start
```

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

- `dm` events should use `scope: "private"` and set `recipient`
- `resource_pin`, `job_posted`, and `planting_request` are usually public
- `id` can be omitted on write; the relay will compute it
- `sig` is stored but not cryptographically verified yet

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
- `includePrivate=true`
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

Pull private messages for one recipient.

```bash
curl "http://localhost:8787/v1/inbox/cedar-fox-12?since=1778160000000"
```

### `GET /v1/stream`

Server-sent events stream for live relay updates.

Example:

```bash
curl -N "http://localhost:8787/v1/stream?kind=resource_pin&tile=okc:z15:35.472:-97.521"
```

### `GET /v1/export.ndjson`

Exports matching events as newline-delimited JSON.

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
