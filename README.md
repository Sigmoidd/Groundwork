# Groundwork OKC

Community-updated map and relay starter for Oklahoma City.

## What is in this repo

- `index.html` — static Cloudflare Pages site
- `relay/` — tiny Node relay for `resource_pin`, `job_posted`, `dm`, and `planting_request`

## Pages build settings

Use Cloudflare Pages with GitHub integration:

- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `/`

## Relay

The relay is meant for a cheap VPS. It keeps an append-only `events.ndjson` log and exposes:

- `GET /health`
- `GET /v1/events`
- `POST /v1/events`
- `GET /v1/inbox/:recipient`
- `GET /v1/stream`

## Ground rules

- Public map pins are public.
- Do not post private-property resources without permission.
- Keep private details in direct messages, not public pins.
