# Oklahoma City Case Study Draft
## Equity-weighted pedestrian routing with public data and community topology

## Research Question

Can a public-data routing graph help people choose cooler, safer, more usable
walking and bike/e-bike routes in Oklahoma City without creating separate
stigmatizing modes?

## Hypothesis

On benign days, default Groundwork routes should look natural and stay close to
shortest-path routing. On high-heat days or when the traveler declares a need,
the same router should shift toward shade, parks, water, libraries, smoother
surfaces, verified curb cuts, and lower-HVI edges.

For bike/e-bike trips, the same router should prefer low-stress streets,
separated trails, verified bike routes, bike racks, repair stands, and useful
stops without forcing a long detour.

## Why OKC

Oklahoma City has the ingredients needed for a meaningful first case:

- public Heat Vulnerability Index layers
- public parks, trails, facilities, and bike route layers
- OSM cycleway, bike parking, and bike repair tags
- public project and pavement-condition layers
- strong heat exposure problem
- wide sidewalk and street-topology gaps
- a real need for dignity-preserving routing

## Data Sources

Use public layers listed in [data_sources.json](./data_sources.json).

Core layers:

- Heat Vulnerability Study 2020
- Parks
- Trails
- Park Amenities
- Facilities
- Active Pedestrian Projects
- Bike Routes
- OpenStreetMap
- NOAA/NWS weather

Community-maintained layer:

- sidewalk closed
- sidewalk missing
- sidewalk ends
- curb cut present/missing
- rough surface
- shade good/poor
- water works/broken
- crossing feels unsafe

## Method

1. Build a base pedestrian graph from OpenStreetMap.
2. Add OKC trails and bike routes as higher-confidence separated paths.
3. Add parks, facilities, park amenities, fire stations, and libraries as
   amenity nodes.
4. Add OSM bike racks, cycleways, bike parking, repair stands, and bike-share
   where available.
5. Spatial-join HVI polygons to every edge.
6. Apply community topology reports to edge attributes.
7. Compute route variants for each benchmark pair:
   - shortest path
   - default Groundwork path
   - hot-day Groundwork path
   - bike/e-bike Groundwork path
7. Compare:
   - distance
   - estimated shade
   - HVI exposure
   - useful amenities within 120m
   - bike stress score
   - bike facilities used
   - topology failures avoided
   - detour percentage

## Metrics

Default route naturalness:

```txt
default_route_length / shortest_route_length <= 1.05
```

Heat-routing improvement:

```txt
hot_route_hvi_exposure < shortest_route_hvi_exposure
```

Amenity usefulness:

```txt
count(water, shade, park, library, rest_seat within 120m)
```

Topology safety:

```txt
count(missing_sidewalk, no_curb_cut, active_construction, rough_surface edges avoided)
```

Bike comfort:

```txt
share_of_route_on(trail, protected_lane, bike_route, low_speed_street)
```

Bike friction:

```txt
count(high_stress_shared_road, dismount_required, blocked_bike_lane edges avoided)
```

## Product Translation

The paper can say:

```txt
equity-weighted pedestrian routing
```

The app should say:

```txt
Cooler walk
More shade
Passes water
Step-free path
Avoids rough sidewalk
```

## Minimum Demo

The first demo should support:

- Plaza District
- Paseo
- Midtown
- Capitol Hill
- Southside

For each area, show:

- normal route
- hot-day route
- bike/e-bike route
- route explanation in casual copy
- public data layers used
- community reports that changed the path

## Expected Output

```json
{
  "route_label": "Cooler walk",
  "distance_m": 1280,
  "adds_min": 3,
  "why": [
    "more shade",
    "passes water",
    "avoids active sidewalk project",
    "uses calmer bike streets"
  ],
  "privacy": "No account required. Location used for this route only."
}
```

## Publication Frame

Title:

```txt
Equity-weighted pedestrian routing using community-maintained topology and heat vulnerability data: an Oklahoma City case study
```

Plain subtitle:

```txt
How a local map can find cooler, safer walks without asking people to identify themselves.
```
