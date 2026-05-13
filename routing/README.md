# Groundwork OKC Routing Case Study
## Equity-weighted pedestrian routing using community-maintained topology and heat vulnerability data

Status: build scaffold  
Scope: Oklahoma City public-data prototype  

This folder turns the routing spec into a reproducible public-data build. It is
designed to ingest public OKC map layers at build time, combine them with
OpenStreetMap and community topology reports, and produce a pedestrian routing
graph that can prefer cooler, safer, more usable routes without asking users to
identify themselves.

## Plain-English Goal

Given the same origin and destination, Groundwork should be able to answer:

```txt
What is the best walk for this person, today?
```

On a nice day with no declared needs, the answer should be close to the shortest
walk. On a hot day, a longer route with shade, water, parks, libraries, or
cooling access may be better. If a sidewalk is missing, closed, rough, or lacks
curb cuts, the route should know that too.

## Public Data Inputs

The build uses a source manifest in [data_sources.json](./data_sources.json).

Primary public inputs:

- OKC Heat Vulnerability Study 2020
- OKC Parks
- OKC Trails
- OKC Park Amenities
- OKC Facilities
- OKC Fire Stations
- OKC Bike Routes
- OSM bike lanes, cycleways, bike parking, bike shops, and repair stands
- OKC Active Pedestrian Projects
- OKC Pavement Condition
- OKC Address Information
- OpenStreetMap pedestrian and street network
- NOAA/NWS weather observations or forecasts

Important: OKC portal data is fetched from public endpoints during ingest. Do
not commit downloaded OKC datasets into this repository unless the license and
terms are reviewed for redistribution.

## Public API Pattern

OKC portal developer API:

```txt
Records API:
https://data.okc.gov/services/portal/api/data/records/{DATASET}

Map API:
https://data.okc.gov/services/portal/api/map/layers/{DATASET}
```

Examples:

```txt
https://data.okc.gov/services/portal/api/data/records/Heat%20Vulnerability%20Study%202020?schemaOnly=true

https://data.okc.gov/services/portal/api/map/layers/Trails?minLatitude=35.3&maxLatitude=35.7&minLongitude=-97.8&maxLongitude=-97.2
```

## Build Pipeline

1. Create PostGIS database.
2. Run [schema.sql](./schema.sql).
3. Fetch public source data using [scripts/fetch_city_data.js](./scripts/fetch_city_data.js).
4. Load [city_data_ingest.sql](./city_data_ingest.sql).
5. Load generated SQL from `routing/build/source_catalog.sql` and
   `routing/build/load_city_features.sql`.
6. Normalize city data with `gw.normalize_city_data()`.
7. Ingest OSM walkable streets and paths into `gw.routing_edges`.
8. Normalize amenities into `gw.amenity_nodes`.
9. Spatial-join HVI to routing edges.
10. Merge city project and work-zone data into route penalties.
11. Run [cost_function.sql](./cost_function.sql).
12. Run [knowledge_graph.sql](./knowledge_graph.sql).
13. Refresh KG mirrors with `gw.kg_refresh_routing()` and, when planner
    tables are loaded, `gw.kg_refresh_planner()`.
14. Test benchmark routes from [test_pairs.sql](./test_pairs.sql).

One-command local/VPS seed:

```bash
DATABASE_URL=postgres://user:pass@host:5432/groundwork ./routing/seed_okc.sh
```

PowerShell:

```powershell
.\routing\seed_okc.ps1 -DatabaseUrl "postgres://user:pass@host:5432/groundwork"
```

The fetch step writes raw downloads under `routing/data/raw/` and generated SQL
under `routing/build/`. Those folders are intentionally gitignored.

## Case Study Question

Can an equity-weighted routing graph improve heat safety and sidewalk usability
while keeping default routes natural?

For bike/e-bike, the same case study also asks whether a local graph can prefer
low-stress bike routes, separated trails, bike racks, repair stands, and calmer
street crossings while keeping useful destinations easy to reach.

Success criteria:

- Default walking routes stay within 5% of OSM shortest path on benign days.
- Default bike/e-bike routes favor separated trails, bike lanes, and lower-speed
  streets without creating unreasonable detours.
- Hot-day routes reduce exposure to high-HVI edges where reasonable.
- Routes pass more useful amenities, such as shade, water, libraries, parks, and
  cooling-adjacent public facilities.
- Bike/e-bike routes pass useful micromobility amenities, such as bike racks,
  bike repair stands, bike-share stations, and public charging where verified.
- Community-reported topology failures, such as missing sidewalk or closed
  sidewalk, change routes quickly.
- No account or persistent GPS tracking is required.

## Data Model

The core routing tables:

- `gw.routing_nodes`
- `gw.routing_edges`
- `gw.amenity_nodes`
- `gw.hvi_areas`
- `gw.community_edge_reports`
- `gw.source_catalog`
- `gw.raw_city_features`
- `gw.city_project_impacts`

The planner and stewardship tables are also typed source tables:

- `gw.places`
- `gw.planner_events`
- `gw.planner_tasks`
- `gw.planner_resources`
- `gw.need_catalog`
- `gw.stewardship_cells`

The knowledge graph tables mirror typed records for explanation and planning:

- `gw.kg_nodes`
- `gw.kg_edges`

The typed tables stay the source of truth. The KG should answer "why this route"
and "what helps this plan nearby," not replace routing, planner, or contribution
records.

The routing cost is calculated in SQL by:

```sql
gw.edge_cost(edge_id, state_json)
```

The route wrapper is:

```sql
gw.route_walk(origin_lon, origin_lat, dest_lon, dest_lat, state_json)
```

Public route explanations come from:

```sql
gw.kg_public_route_explanations(edge_ids, state_json)
```

Planner enrichment for public events comes from:

```sql
gw.kg_public_planner_context(event_id, radius_m)
```

Both functions enforce public visibility. Private planner nodes, matched-only
services, and verified-only data must not appear in casual routing responses.

## Community Topology Layer

Public data is the base. Community reports are the moat.

Examples:

```txt
sidewalk closed
sidewalk ends
no curb cut
rough surface
unsafe crossing
painted bike lane blocked
trail closure
dangerous bike crossing
missing bike rack
good shade
water fountain works
bench present
```

Reports should be pseudonymous, time-decayed, and trust-weighted. The router
should treat low-risk confirmed topology reports as data, not comments.

## City Data Layer

The first real build uses these public layers:

- OKC Street Centerlines
- OKC City Boundaries
- OKC Heat Vulnerability Study 2020
- OKC Parks
- OKC Trails
- OKC Park Amenities
- OKC Facilities
- OKC Fire Stations
- OKC Bike Routes
- OKC Bike Projects
- OKC Active Pedestrian Projects
- OKC Pavement Condition
- OKC Work Zones
- OKC Adopted Streets
- OKC Address Information
- OpenStreetMap walk/bike ways and useful public amenities
- EMBARK static GTFS stops
- NOAA/NWS weather point metadata

`scripts/fetch_city_data.js` fetches OKC map layers into GeoJSON, converts OSM
Overpass output into GeoJSON when `--with-osm` is used, and emits SQL that calls
`gw.import_city_feature(...)`. If the OKC portal blocks automated API access,
download the same layers from the portal UI, place them in `routing/data/raw/`,
and keep them out of git. The normalization functions do not require raw data to
be committed.

After loading raw features:

```sql
SELECT * FROM gw.normalize_city_data();
```

That normalizes:

- HVI polygons into `gw.hvi_areas`
- parks, facilities, fire stations, OSM amenities, and GTFS stops into
  `gw.amenity_nodes`
- trails, bike routes, street centerlines, and OSM walk/bike ways into
  `gw.routing_edges`
- city project/work-zone layers into `gw.city_project_impacts`
- the first five stewardship Voronoi seeds into `gw.stewardship_cells`

The first five stewardship seeds are Uptown, Paseo, Midtown, Southside, and
Capitol Hill. Voronoi cells are rebuilt in PostGIS so route edges can be linked
to the responsible stewardship cell.

## User-Facing Copy

Do not expose "equity-weighted routing" in normal UX.

Use:

```txt
Cooler walk
Step-free path
More shade
Passes water
Avoids rough sidewalk
Adds 3 minutes for shade
Uses calmer bike streets
Bike rack near destination
```

Internal math stays internal. The user sees what helps them decide.

## Knowledge Graph Acceptance Checks

- A hot-day walking route can explain shade, water, and heat-vulnerability
  choices in casual copy.
- A bike/e-bike route can explain calmer bike facilities and bike-rack proximity.
- A community report such as `sidewalk closed` changes route cost through the
  typed routing layer, then appears as a verified-only graph relation.
- A public planner event can ask for nearby water, shade, bike parking, and rest
  stops without learning private planner details.
- Sensitive or private planner nodes are filtered before public graph results
  leave the database.

## Public Source Notes

The OKC Heat Vulnerability Index was developed by University of Oklahoma
researchers led by Dr. Wenwen Cheng and funded by NASA. OKC's public heat pages
describe the index as considering sensitivity, adaptive capacity, and exposure.

The City of OKC Open Data Portal provides public records and map APIs. Its terms
include warranty disclaimers and restrictions against redistributing or reselling
the provided information. This project should fetch sources during ingest and
store derived, attribution-safe metadata only after license review.
