CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS gw;

CREATE TABLE IF NOT EXISTS gw.source_catalog (
  source_key text PRIMARY KEY,
  source_name text NOT NULL,
  source_url text NOT NULL,
  license_note text NOT NULL DEFAULT '',
  fetched_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gw.routing_nodes (
  id bigserial PRIMARY KEY,
  source text NOT NULL DEFAULT 'derived',
  source_id text,
  geom geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routing_nodes_geom_idx
  ON gw.routing_nodes USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.routing_edges (
  id bigserial PRIMARY KEY,
  source text NOT NULL DEFAULT 'osm',
  source_id text,
  kind text NOT NULL DEFAULT 'sidewalk',
  from_node bigint REFERENCES gw.routing_nodes(id),
  to_node bigint REFERENCES gw.routing_nodes(id),
  geom geometry(LineString, 4326) NOT NULL,
  length_m double precision GENERATED ALWAYS AS (ST_Length(geom::geography)) STORED,

  surface text NOT NULL DEFAULT 'unknown',
  width_m double precision,
  has_curb_cuts boolean,
  curb_cut_quality text NOT NULL DEFAULT 'unknown',
  shade_summer double precision NOT NULL DEFAULT 0.0,
  shade_winter double precision NOT NULL DEFAULT 0.0,
  lighting text NOT NULL DEFAULT 'unknown',
  adjacent_speed_mph integer,
  active_construction boolean NOT NULL DEFAULT false,
  expected_open_date date,
  last_verified_at timestamptz,

  bike_facility text NOT NULL DEFAULT 'unknown',
  bike_comfort_class text NOT NULL DEFAULT 'unknown',
  bike_stress_score double precision,
  bike_parking_nearby boolean,
  micromobility_allowed boolean,
  ebike_allowed boolean,
  scooter_allowed boolean,
  dismount_required boolean NOT NULL DEFAULT false,

  hvi_score double precision,
  hvi_quantile double precision,
  community_confidence double precision NOT NULL DEFAULT 0.0,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routing_edges_geom_idx
  ON gw.routing_edges USING gist (geom);

CREATE INDEX IF NOT EXISTS routing_edges_from_to_idx
  ON gw.routing_edges (from_node, to_node);

CREATE INDEX IF NOT EXISTS routing_edges_bike_facility_idx
  ON gw.routing_edges (bike_facility, bike_comfort_class);

CREATE TABLE IF NOT EXISTS gw.hvi_areas (
  id bigserial PRIMARY KEY,
  source text NOT NULL DEFAULT 'okc_hvi_2020',
  source_id text,
  study_year integer NOT NULL DEFAULT 2020,
  hvi_score double precision,
  hvi_quantile double precision,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS hvi_areas_geom_idx
  ON gw.hvi_areas USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.amenity_nodes (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  source_id text,
  kind text NOT NULL,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,

  requires_id boolean,
  requires_sobriety boolean,
  requires_referral boolean,
  requires_religious_participation boolean,
  walk_in_accepted boolean,

  ada_accessible boolean,
  family_friendly boolean,
  pet_friendly boolean,
  gender_inclusive boolean,

  capacity integer,
  current_capacity integer,
  capacity_updated_at timestamptz,
  languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'public',
  delight_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at timestamptz,
  geom geometry(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS amenity_nodes_geom_idx
  ON gw.amenity_nodes USING gist (geom);

CREATE INDEX IF NOT EXISTS amenity_nodes_kind_idx
  ON gw.amenity_nodes (kind);

CREATE TABLE IF NOT EXISTS gw.community_edge_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id bigint REFERENCES gw.routing_edges(id),
  report_kind text NOT NULL,
  report_value text NOT NULL DEFAULT '',
  trust_weight double precision NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  local_actor_ref text,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS community_edge_reports_edge_idx
  ON gw.community_edge_reports (edge_id, status);

CREATE TABLE IF NOT EXISTS gw.route_benchmark_pairs (
  id text PRIMARY KEY,
  label text NOT NULL,
  origin geometry(Point, 4326) NOT NULL,
  destination geometry(Point, 4326) NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_note text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS route_benchmark_pairs_origin_idx
  ON gw.route_benchmark_pairs USING gist (origin);

CREATE INDEX IF NOT EXISTS route_benchmark_pairs_destination_idx
  ON gw.route_benchmark_pairs USING gist (destination);

CREATE TABLE IF NOT EXISTS gw.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key text UNIQUE,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  geom geometry(Geometry, 4326) NOT NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE INDEX IF NOT EXISTS places_geom_idx
  ON gw.places USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.planner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE,
  title text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  place_id uuid REFERENCES gw.places(id),
  visibility text NOT NULL DEFAULT 'public',
  geom geometry(Point, 4326),
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE INDEX IF NOT EXISTS planner_events_geom_idx
  ON gw.planner_events USING gist (geom);

CREATE INDEX IF NOT EXISTS planner_events_time_idx
  ON gw.planner_events (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS gw.planner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES gw.planner_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  visibility text NOT NULL DEFAULT 'public',
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE INDEX IF NOT EXISTS planner_tasks_event_idx
  ON gw.planner_tasks (event_id, status);

CREATE TABLE IF NOT EXISTS gw.planner_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key text UNIQUE,
  kind text NOT NULL,
  label text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  geom geometry(Point, 4326),
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE INDEX IF NOT EXISTS planner_resources_geom_idx
  ON gw.planner_resources USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.need_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_key text UNIQUE NOT NULL,
  label text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE TABLE IF NOT EXISTS gw.planner_event_resources (
  event_id uuid NOT NULL REFERENCES gw.planner_events(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES gw.planner_resources(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public',
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (event_id, resource_id),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE TABLE IF NOT EXISTS gw.planner_task_resources (
  task_id uuid NOT NULL REFERENCES gw.planner_tasks(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES gw.planner_resources(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public',
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (task_id, resource_id),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE TABLE IF NOT EXISTS gw.amenity_need_links (
  amenity_id bigint NOT NULL REFERENCES gw.amenity_nodes(id) ON DELETE CASCADE,
  need_id uuid NOT NULL REFERENCES gw.need_catalog(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public',
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (amenity_id, need_id),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE TABLE IF NOT EXISTS gw.stewardship_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_key text UNIQUE NOT NULL,
  name text NOT NULL,
  owner_ref text NOT NULL DEFAULT '',
  capacity_state text NOT NULL DEFAULT 'normal',
  visibility text NOT NULL DEFAULT 'public',
  seed_geom geometry(Point, 4326) NOT NULL,
  geom geometry(MultiPolygon, 4326),
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (capacity_state IN ('under_capacity', 'normal', 'near_capacity', 'over_capacity')),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE INDEX IF NOT EXISTS stewardship_cells_seed_geom_idx
  ON gw.stewardship_cells USING gist (seed_geom);

CREATE INDEX IF NOT EXISTS stewardship_cells_geom_idx
  ON gw.stewardship_cells USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.kg_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type text NOT NULL,
  source_table text NOT NULL DEFAULT '',
  source_pk text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public',
  geom geometry(Geometry, 4326),
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (node_type IN (
    'place',
    'route_edge',
    'amenity',
    'event',
    'task',
    'resource',
    'need',
    'report',
    'stewardship_cell',
    'hvi_area',
    'source'
  )),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kg_nodes_source_unique_idx
  ON gw.kg_nodes (node_type, source_table, source_pk)
  WHERE source_table <> '' AND source_pk <> '';

CREATE INDEX IF NOT EXISTS kg_nodes_geom_idx
  ON gw.kg_nodes USING gist (geom);

CREATE INDEX IF NOT EXISTS kg_nodes_type_visibility_idx
  ON gw.kg_nodes (node_type, visibility);

CREATE TABLE IF NOT EXISTS gw.kg_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node uuid NOT NULL REFERENCES gw.kg_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES gw.kg_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  weight double precision NOT NULL DEFAULT 1.0,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CHECK (relation IN (
    'place_has_amenity',
    'edge_near_amenity',
    'edge_in_hvi_area',
    'report_updates_edge',
    'event_at_place',
    'event_requires_resource',
    'task_requires_resource',
    'amenity_serves_need',
    'amenity_has_friction',
    'cell_contains_edge',
    'route_passes_amenity'
  )),
  CHECK (visibility IN ('public', 'matched', 'verified_only', 'private', 'destroy_with_relay'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kg_edges_unique_live_idx
  ON gw.kg_edges (from_node, relation, to_node)
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS kg_edges_from_relation_idx
  ON gw.kg_edges (from_node, relation, visibility);

CREATE INDEX IF NOT EXISTS kg_edges_to_relation_idx
  ON gw.kg_edges (to_node, relation, visibility);

COMMENT ON TABLE gw.routing_edges IS
  'Pedestrian and micromobility routing graph. Public data is augmented by community topology reports.';

COMMENT ON COLUMN gw.routing_edges.hvi_score IS
  'Heat Vulnerability Index value spatially joined from OKC HVI public data.';

COMMENT ON COLUMN gw.routing_edges.bike_facility IS
  'Bike/e-bike facility classification from OSM, OKC Bike Routes, trails, and community reports.';

COMMENT ON COLUMN gw.routing_edges.bike_stress_score IS
  'Low-stress bike routing score. Lower is calmer. Derived from facility, speed, road context, and community reports.';

COMMENT ON COLUMN gw.amenity_nodes.visibility IS
  'public, matched, or verified_only. Do not expose sensitive services in casual routes unless matched.';

COMMENT ON TABLE gw.kg_nodes IS
  'Routing-first knowledge graph nodes mirrored from typed source tables. Do not treat this as source of truth.';

COMMENT ON TABLE gw.kg_edges IS
  'Typed knowledge graph relations used for route explanations, planner enrichment, and safe public filtering.';

COMMENT ON COLUMN gw.kg_nodes.visibility IS
  'Visibility is enforced before graph data reaches public routing responses.';
