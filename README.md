# Groundwork OKC v2

Static site bundle for Cloudflare Pages or GitHub Pages.

## Added in v2

- Real map pins with Leaflet + OpenStreetMap tiles
- Better submit-a-resource flow with tap-to-place and geolocation
- Relay write/pull sync for public events, group pins, and inbox messages
- Germinate / planting planner using simple permaculture principles
- Migration from prior `groundwork-okc-v1` local storage

## Deploy on Cloudflare Pages

Upload the contents of this folder or the zip archive to your Pages project.

## Notes

- This build is still local-first. Messages and pins are stored in the browser first, then synced through the configured relay.
- The default relay is `https://relay.groundworkokc.org`.
- Use only public or permissioned resource pins.
