# Groundwork OKC v2

Static site bundle for Cloudflare Pages or GitHub Pages.

## Added in v2

- Real map pins with Leaflet + OpenStreetMap tiles
- Better submit-a-resource flow with tap-to-place and geolocation
- Relay write/pull sync for public events, group pins, and inbox messages
- Public resource confirmations with recent community consensus
- Germinate / planting planner using simple permaculture principles
- Migration from prior `groundwork-okc-v1` local storage

## Deploy on Cloudflare Pages

Upload the contents of this folder or the zip archive to your Pages project.

## Notes

- This build is still local-first. Messages and pins are stored in the browser first, then synced through the configured relay.
- The default relay is `https://relay.groundworkokc.org`.
- Public pins, confirmations, public events, jobs, and public planner requests go to `/v1/events`. These are open civic records and are eligible for future Nostr-compatible public mirroring.
- Group pins and DMs are private posts. They are written through `/v1/events`, but read only from `/v1/inbox/:recipient`. They never appear in `/v1/events`, `/v1/stream`, `/v1/export.ndjson`, or any Nostr mirror.
- GRTAP capability, attendance, and safety-proof requests are not posts. They use the `/v1/canopy/*` and `/v1/lantern/*` endpoints and store only the minimum replay/safety records.
- Use only public or permissioned resource pins.
