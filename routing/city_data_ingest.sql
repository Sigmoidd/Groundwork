CREATE TABLE IF NOT EXISTS gw.raw_city_features (
  id bigserial PRIMARY KEY,
  source_key text NOT NULL,
  feature_id text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Geometry, 4326),
  UNIQUE (source_key, feature_id)
);

CREATE INDEX IF NOT EXISTS raw_city_features_source_idx
  ON gw.raw_city_features (source_key);

CREATE INDEX IF NOT EXISTS raw_city_features_geom_idx
  ON gw.raw_city_features USING gist (geom);

CREATE TABLE IF NOT EXISTS gw.city_project_impacts (
  id bigserial PRIMARY KEY,
  source_key text NOT NULL,
  feature_id text NOT NULL,
  project_kind text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  geom geometry(Geometry, 4326) NOT NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, feature_id)
);

CREATE INDEX IF NOT EXISTS city_project_impacts_geom_idx
  ON gw.city_project_impacts USING gist (geom);

CREATE UNIQUE INDEX IF NOT EXISTS routing_nodes_source_id_unique_idx
  ON gw.routing_nodes (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS routing_edges_source_id_unique_idx
  ON gw.routing_edges (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS amenity_nodes_source_id_unique_idx
  ON gw.amenity_nodes (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hvi_areas_source_id_unique_idx
  ON gw.hvi_areas (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION gw.jsonb_pick_text(
  p_props jsonb,
  VARIADIC p_keys text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_value text;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    v_value := nullif(btrim(p_props ->> v_key), '');
    IF v_value IS NOT NULL THEN
      RETURN v_value;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION gw.jsonb_pick_number(
  p_props jsonb,
  VARIADIC p_keys text[]
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := gw.jsonb_pick_text(p_props, VARIADIC p_keys);
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;
  v_text := regexp_replace(v_text, '[^0-9.\-]+', '', 'g');
  IF v_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_text::double precision;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION gw.jsonb_pick_bool(
  p_props jsonb,
  VARIADIC p_keys text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := lower(coalesce(gw.jsonb_pick_text(p_props, VARIADIC p_keys), ''));
  IF v_text IN ('true', 'yes', 'y', '1', 'open', 'active') THEN
    RETURN true;
  END IF;
  IF v_text IN ('false', 'no', 'n', '0', 'closed', 'inactive') THEN
    RETURN false;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION gw.import_city_feature(
  p_source_key text,
  p_feature_id text,
  p_geom_geojson jsonb,
  p_properties jsonb DEFAULT '{}'::jsonb,
  p_raw jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_geom geometry(Geometry, 4326);
BEGIN
  IF p_geom_geojson IS NOT NULL AND p_geom_geojson <> 'null'::jsonb THEN
    v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geom_geojson::text), 4326);
  END IF;

  INSERT INTO gw.raw_city_features (
    source_key,
    feature_id,
    properties,
    raw,
    geom
  )
  VALUES (
    p_source_key,
    coalesce(nullif(p_feature_id, ''), encode(digest(p_raw::text, 'sha256'), 'hex')),
    coalesce(p_properties, '{}'::jsonb),
    coalesce(p_raw, '{}'::jsonb),
    v_geom
  )
  ON CONFLICT (source_key, feature_id) DO UPDATE
  SET fetched_at = now(),
      properties = excluded.properties,
      raw = excluded.raw,
      geom = excluded.geom;
END;
$$;

CREATE OR REPLACE FUNCTION gw.feature_label(
  p_props jsonb,
  p_fallback text DEFAULT ''
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    gw.jsonb_pick_text(
      p_props,
      'name',
      'Name',
      'NAME',
      'park_name',
      'PARK_NAME',
      'facility_name',
      'FACILITY_NAME',
      'trail_name',
      'TRAIL_NAME',
      'street_name',
      'STREET_NAME',
      'full_street_name',
      'FULL_STREET_NAME',
      'route',
      'ROUTE'
    ),
    p_fallback
  );
$$;

CREATE OR REPLACE FUNCTION gw.classify_city_amenity(
  p_source_key text,
  p_props jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := lower(concat_ws(' ',
    p_source_key,
    gw.feature_label(p_props, ''),
    gw.jsonb_pick_text(p_props, 'type', 'Type', 'TYPE', 'amenity', 'Amenity', 'AMENITY'),
    gw.jsonb_pick_text(p_props, 'description', 'Description', 'DESCRIPTION', 'facility_type', 'FACILITY_TYPE')
  ));

  IF p_source_key = 'fire_stations' THEN
    RETURN 'fire_station';
  END IF;
  IF p_source_key = 'embark_gtfs_static' THEN
    RETURN 'transit_stop';
  END IF;
  IF p_source_key = 'parks' THEN
    RETURN 'park';
  END IF;
  IF v_text ~ '(water fountain|drinking water|fountain)' THEN
    RETURN 'water_fountain';
  END IF;
  IF v_text ~ '(restroom|toilet|bathroom)' THEN
    RETURN 'restroom_public';
  END IF;
  IF v_text ~ '(shade|shelter|pavilion|gazebo)' THEN
    RETURN 'shade_built';
  END IF;
  IF v_text ~ '(splash|sprayground|spray ground|pool|aquatic)' THEN
    RETURN 'splash_pad';
  END IF;
  IF v_text ~ '(playground|play area)' THEN
    RETURN 'playground';
  END IF;
  IF v_text ~ '(dog park)' THEN
    RETURN 'dog_park';
  END IF;
  IF v_text ~ '(garden|community garden|botanical)' THEN
    RETURN 'community_garden';
  END IF;
  IF v_text ~ '(library)' THEN
    RETURN 'library';
  END IF;
  IF v_text ~ '(senior|community center|rec center|recreation center)' THEN
    RETURN 'cooling_center';
  END IF;
  IF v_text ~ '(bench|seat)' THEN
    RETURN 'rest_seat';
  END IF;
  IF v_text ~ '(bike rack|bicycle parking)' THEN
    RETURN 'bike_rack';
  END IF;
  IF v_text ~ '(bike repair|fixit|repair stand)' THEN
    RETURN 'bike_repair_stand';
  END IF;
  IF p_source_key IN ('facilities', 'park_amenities') THEN
    RETURN 'park_facility';
  END IF;
  IF p_source_key = 'osm_walk_bike' AND v_text ~ '(parking)' AND v_text ~ '(bicycle|bike)' THEN
    RETURN 'bike_rack';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION gw.classify_city_edge_kind(
  p_source_key text,
  p_props jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := lower(concat_ws(' ',
    p_source_key,
    gw.feature_label(p_props, ''),
    gw.jsonb_pick_text(p_props, 'type', 'Type', 'TYPE', 'route_type', 'ROUTE_TYPE', 'facility', 'FACILITY'),
    gw.jsonb_pick_text(p_props, 'highway', 'cycleway', 'footway', 'bicycle')
  ));

  IF p_source_key = 'trails' OR v_text ~ '(trail|greenway|path)' THEN
    RETURN 'trail';
  END IF;
  IF v_text ~ '(protected|separated)' THEN
    RETURN 'bike_lane_separated';
  END IF;
  IF v_text ~ '(bike lane|bikelane|cycle lane|dedicated)' THEN
    RETURN 'bike_lane_painted';
  END IF;
  IF v_text ~ '(footway|sidewalk|pedestrian|crosswalk)' THEN
    RETURN 'sidewalk';
  END IF;
  RETURN 'shared_road';
END;
$$;

CREATE OR REPLACE FUNCTION gw.classify_city_bike_facility(
  p_source_key text,
  p_props jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := lower(concat_ws(' ',
    p_source_key,
    gw.feature_label(p_props, ''),
    gw.jsonb_pick_text(p_props, 'type', 'Type', 'TYPE', 'route_type', 'ROUTE_TYPE', 'facility', 'FACILITY'),
    gw.jsonb_pick_text(p_props, 'cycleway', 'bicycle', 'highway')
  ));

  IF v_text ~ '(mountain|off-road|singletrack)' THEN
    RETURN 'trail';
  END IF;
  IF v_text ~ '(trail|greenway|multi-use|multiuse|path)' THEN
    RETURN 'trail';
  END IF;
  IF v_text ~ '(protected|separated|cycle track)' THEN
    RETURN 'protected_lane';
  END IF;
  IF v_text ~ '(bike lane|bikelane|dedicated|lane)' THEN
    RETURN 'bike_lane';
  END IF;
  IF v_text ~ '(shared|sharrow|signed route)' THEN
    RETURN 'shared_route';
  END IF;
  RETURN 'unknown';
END;
$$;

CREATE OR REPLACE FUNCTION gw.infer_bike_stress(
  p_source_key text,
  p_props jsonb
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE gw.classify_city_bike_facility(p_source_key, p_props)
    WHEN 'trail' THEN 0.12
    WHEN 'protected_lane' THEN 0.2
    WHEN 'bike_lane' THEN 0.45
    WHEN 'shared_route' THEN 0.7
    ELSE CASE
      WHEN coalesce(gw.jsonb_pick_number(p_props, 'speed', 'SPEED', 'speed_mph', 'SPEED_MPH', 'speedlimit'), 35) <= 25 THEN 0.55
      WHEN coalesce(gw.jsonb_pick_number(p_props, 'speed', 'SPEED', 'speed_mph', 'SPEED_MPH', 'speedlimit'), 35) <= 35 THEN 0.8
      ELSE 1.0
    END
  END;
$$;

CREATE OR REPLACE FUNCTION gw.point_key(
  p_geom geometry
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat(round(ST_X(p_geom)::numeric, 6), ',', round(ST_Y(p_geom)::numeric, 6));
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_hvi()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.hvi_areas (
    source,
    source_id,
    study_year,
    hvi_score,
    hvi_quantile,
    attrs,
    geom
  )
  SELECT
    source_key,
    feature_id,
    2020,
    gw.jsonb_pick_number(properties, 'hvi', 'HVI', 'hvi_score', 'HVI_SCORE', 'index', 'INDEX'),
    gw.jsonb_pick_number(properties, 'hvi_quantile', 'HVI_QUANTILE', 'quantile', 'QUANTILE', 'rank', 'RANK'),
    properties,
    ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))::geometry(MultiPolygon, 4326)
  FROM gw.raw_city_features
  WHERE source_key = 'hvi_2020'
    AND geom IS NOT NULL
    AND ST_GeometryType(geom) IN ('ST_Polygon', 'ST_MultiPolygon')
  ON CONFLICT (source, source_id) DO UPDATE
  SET hvi_score = excluded.hvi_score,
      hvi_quantile = excluded.hvi_quantile,
      attrs = excluded.attrs,
      geom = excluded.geom;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_places()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.places (
    place_key,
    name,
    visibility,
    geom,
    attrs
  )
  SELECT
    concat(source_key, ':', feature_id),
    gw.feature_label(properties, concat('OKC ', source_key, ' ', feature_id)),
    'public',
    geom,
    jsonb_build_object('source_key', source_key, 'feature_id', feature_id, 'properties', properties)
  FROM gw.raw_city_features
  WHERE source_key IN ('parks', 'city_boundaries')
    AND geom IS NOT NULL
  ON CONFLICT (place_key) DO UPDATE
  SET name = excluded.name,
      visibility = excluded.visibility,
      geom = excluded.geom,
      attrs = excluded.attrs,
      updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_amenities()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.amenity_nodes (
    source,
    source_id,
    kind,
    name,
    address,
    visibility,
    delight_tags,
    provenance,
    geom
  )
  SELECT
    source_key,
    feature_id,
    gw.classify_city_amenity(source_key, properties),
    gw.feature_label(properties, concat(source_key, ' ', feature_id)),
    coalesce(gw.jsonb_pick_text(properties, 'address', 'Address', 'ADDRESS', 'location', 'LOCATION'), ''),
    'public',
    jsonb_build_object(
      'nature', source_key IN ('parks', 'park_amenities', 'facilities'),
      'city_data', true
    ),
    jsonb_build_object('source_key', source_key, 'feature_id', feature_id, 'properties', properties),
    ST_PointOnSurface(geom)::geometry(Point, 4326)
  FROM gw.raw_city_features
  WHERE source_key IN ('parks', 'park_amenities', 'facilities', 'fire_stations', 'osm_walk_bike', 'embark_gtfs_static')
    AND geom IS NOT NULL
    AND gw.classify_city_amenity(source_key, properties) IS NOT NULL
  ON CONFLICT (source, source_id) DO UPDATE
  SET kind = excluded.kind,
      name = excluded.name,
      address = excluded.address,
      visibility = excluded.visibility,
      delight_tags = excluded.delight_tags,
      provenance = excluded.provenance,
      geom = excluded.geom;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_edges()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.routing_edges (
    source,
    source_id,
    kind,
    geom,
    surface,
    lighting,
    adjacent_speed_mph,
    bike_facility,
    bike_comfort_class,
    bike_stress_score,
    micromobility_allowed,
    ebike_allowed,
    scooter_allowed,
    attrs
  )
  SELECT
    source_key,
    concat(feature_id, ':', dump.path[1]::text),
    gw.classify_city_edge_kind(source_key, properties),
    dump.geom::geometry(LineString, 4326),
    coalesce(gw.jsonb_pick_text(properties, 'surface', 'Surface', 'SURFACE'), 'unknown'),
    coalesce(gw.jsonb_pick_text(properties, 'lighting', 'Lighting', 'LIGHTING'), 'unknown'),
    gw.jsonb_pick_number(properties, 'speed', 'SPEED', 'speed_mph', 'SPEED_MPH', 'speedlimit')::integer,
    gw.classify_city_bike_facility(source_key, properties),
    CASE
      WHEN gw.infer_bike_stress(source_key, properties) <= 0.25 THEN 'comfortable'
      WHEN gw.infer_bike_stress(source_key, properties) <= 0.55 THEN 'mixed'
      ELSE 'stressful'
    END,
    gw.infer_bike_stress(source_key, properties),
    source_key IN ('trails', 'bike_routes', 'osm_walk_bike'),
    source_key IN ('trails', 'bike_routes', 'osm_walk_bike'),
    source_key IN ('bike_routes', 'osm_walk_bike'),
    jsonb_build_object('source_key', source_key, 'feature_id', feature_id, 'properties', properties)
  FROM gw.raw_city_features raw
  CROSS JOIN LATERAL ST_Dump(ST_CollectionExtract(ST_MakeValid(raw.geom), 2)) AS dump
  WHERE source_key IN ('street_centerlines', 'trails', 'bike_routes', 'osm_walk_bike')
    AND raw.geom IS NOT NULL
    AND NOT ST_IsEmpty(dump.geom)
  ON CONFLICT (source, source_id) DO UPDATE
  SET kind = excluded.kind,
      geom = excluded.geom,
      surface = excluded.surface,
      lighting = excluded.lighting,
      adjacent_speed_mph = excluded.adjacent_speed_mph,
      bike_facility = excluded.bike_facility,
      bike_comfort_class = excluded.bike_comfort_class,
      bike_stress_score = excluded.bike_stress_score,
      micromobility_allowed = excluded.micromobility_allowed,
      ebike_allowed = excluded.ebike_allowed,
      scooter_allowed = excluded.scooter_allowed,
      attrs = excluded.attrs;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.rebuild_city_routing_nodes()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH endpoints AS (
    SELECT id AS edge_id, 'from' AS side, ST_StartPoint(geom) AS geom
    FROM gw.routing_edges
    WHERE source IN ('street_centerlines', 'trails', 'bike_routes', 'osm_walk_bike')
      AND geom IS NOT NULL
    UNION ALL
    SELECT id AS edge_id, 'to' AS side, ST_EndPoint(geom) AS geom
    FROM gw.routing_edges
    WHERE source IN ('street_centerlines', 'trails', 'bike_routes', 'osm_walk_bike')
      AND geom IS NOT NULL
  ),
  unique_points AS (
    SELECT DISTINCT gw.point_key(geom) AS node_key, geom
    FROM endpoints
  )
  INSERT INTO gw.routing_nodes (source, source_id, geom)
  SELECT 'derived_city_endpoint', node_key, geom
  FROM unique_points
  ON CONFLICT (source, source_id) DO NOTHING;

  WITH endpoints AS (
    SELECT id AS edge_id, 'from' AS side, gw.point_key(ST_StartPoint(geom)) AS node_key
    FROM gw.routing_edges
    WHERE source IN ('street_centerlines', 'trails', 'bike_routes', 'osm_walk_bike')
      AND geom IS NOT NULL
    UNION ALL
    SELECT id AS edge_id, 'to' AS side, gw.point_key(ST_EndPoint(geom)) AS node_key
    FROM gw.routing_edges
    WHERE source IN ('street_centerlines', 'trails', 'bike_routes', 'osm_walk_bike')
      AND geom IS NOT NULL
  )
  UPDATE gw.routing_edges edge
  SET from_node = CASE WHEN endpoints.side = 'from' THEN node.id ELSE edge.from_node END,
      to_node = CASE WHEN endpoints.side = 'to' THEN node.id ELSE edge.to_node END
  FROM endpoints
  JOIN gw.routing_nodes node
    ON node.source = 'derived_city_endpoint'
   AND node.source_id = endpoints.node_key
  WHERE edge.id = endpoints.edge_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_project_impacts()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.city_project_impacts (
    source_key,
    feature_id,
    project_kind,
    status,
    starts_at,
    ends_at,
    geom,
    attrs
  )
  SELECT
    source_key,
    feature_id,
    CASE source_key
      WHEN 'work_zones' THEN 'work_zone'
      WHEN 'active_pedestrian_projects' THEN 'pedestrian_project'
      WHEN 'bike_projects' THEN 'bike_project'
      ELSE 'city_project'
    END,
    lower(coalesce(gw.jsonb_pick_text(properties, 'status', 'Status', 'STATUS', 'phase', 'PHASE'), 'active')),
    NULL,
    NULL,
    geom,
    jsonb_build_object('source_key', source_key, 'feature_id', feature_id, 'properties', properties)
  FROM gw.raw_city_features
  WHERE source_key IN ('work_zones', 'active_pedestrian_projects', 'bike_projects')
    AND geom IS NOT NULL
  ON CONFLICT (source_key, feature_id) DO UPDATE
  SET project_kind = excluded.project_kind,
      status = excluded.status,
      geom = excluded.geom,
      attrs = excluded.attrs;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.apply_city_project_impacts()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE gw.routing_edges edge
  SET active_construction = true,
      attrs = edge.attrs || jsonb_build_object('city_project_nearby', true)
  WHERE EXISTS (
    SELECT 1
    FROM gw.city_project_impacts impact
    WHERE impact.status !~ '(complete|closed|inactive|cancel)'
      AND ST_DWithin(edge.geom::geography, impact.geom::geography, 35)
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.seed_okc_stewardship_cells()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO gw.stewardship_cells (
    cell_key,
    name,
    owner_ref,
    capacity_state,
    visibility,
    seed_geom,
    attrs
  )
  VALUES
    ('uptown', 'Uptown', 'gocp:uptown', 'normal', 'public', ST_SetSRID(ST_Point(-97.5295, 35.4932), 4326), '{"seed_order": 1}'::jsonb),
    ('paseo', 'Paseo', 'gocp:paseo', 'normal', 'public', ST_SetSRID(ST_Point(-97.5251, 35.5018), 4326), '{"seed_order": 2}'::jsonb),
    ('midtown', 'Midtown', 'gocp:midtown', 'normal', 'public', ST_SetSRID(ST_Point(-97.5207, 35.4776), 4326), '{"seed_order": 3}'::jsonb),
    ('southside', 'Southside', 'gocp:southside', 'normal', 'public', ST_SetSRID(ST_Point(-97.5225, 35.4337), 4326), '{"seed_order": 4}'::jsonb),
    ('capitol_hill', 'Capitol Hill', 'gocp:capitol_hill', 'normal', 'public', ST_SetSRID(ST_Point(-97.5165, 35.4564), 4326), '{"seed_order": 5}'::jsonb)
  ON CONFLICT (cell_key) DO UPDATE
  SET name = excluded.name,
      owner_ref = excluded.owner_ref,
      seed_geom = excluded.seed_geom,
      attrs = excluded.attrs,
      updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.rebuild_stewardship_voronoi()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH city_extent AS (
    SELECT coalesce(
      (
        SELECT ST_Multi(ST_Union(geom))::geometry(MultiPolygon, 4326)
        FROM gw.raw_city_features
        WHERE source_key = 'city_boundaries'
          AND geom IS NOT NULL
      ),
      ST_Multi(ST_Envelope(ST_Buffer(ST_Collect(seed_geom)::geography, 12000)::geometry))::geometry(MultiPolygon, 4326)
    ) AS geom
    FROM gw.stewardship_cells
  ),
  voronoi AS (
    SELECT (ST_Dump(ST_VoronoiPolygons(ST_Collect(seed_geom), 0, city_extent.geom))).geom AS geom
    FROM gw.stewardship_cells
    CROSS JOIN city_extent
    GROUP BY city_extent.geom
  ),
  matched AS (
    SELECT DISTINCT ON (cell.id)
      cell.id,
      ST_Multi(ST_Intersection(voronoi.geom, city_extent.geom))::geometry(MultiPolygon, 4326) AS geom
    FROM gw.stewardship_cells cell
    CROSS JOIN city_extent
    JOIN voronoi
      ON ST_Intersects(voronoi.geom, city_extent.geom)
    ORDER BY cell.id, cell.seed_geom <-> voronoi.geom
  )
  UPDATE gw.stewardship_cells cell
  SET geom = matched.geom,
      updated_at = now()
  FROM matched
  WHERE cell.id = matched.id
    AND NOT ST_IsEmpty(matched.geom);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION gw.normalize_city_data()
RETURNS TABLE(step text, affected integer)
LANGUAGE plpgsql
AS $$
BEGIN
  step := 'hvi_areas';
  affected := gw.normalize_city_hvi();
  RETURN NEXT;

  step := 'places';
  affected := gw.normalize_city_places();
  RETURN NEXT;

  step := 'amenities';
  affected := gw.normalize_city_amenities();
  RETURN NEXT;

  step := 'routing_edges';
  affected := gw.normalize_city_edges();
  RETURN NEXT;

  step := 'routing_nodes';
  affected := gw.rebuild_city_routing_nodes();
  RETURN NEXT;

  step := 'project_impacts';
  affected := gw.normalize_city_project_impacts();
  RETURN NEXT;

  step := 'project_cost_flags';
  affected := gw.apply_city_project_impacts();
  RETURN NEXT;

  step := 'stewardship_seeds';
  affected := gw.seed_okc_stewardship_cells();
  RETURN NEXT;

  step := 'stewardship_voronoi';
  affected := gw.rebuild_stewardship_voronoi();
  RETURN NEXT;
END;
$$;
