CREATE OR REPLACE FUNCTION gw.state_text(state jsonb, key text, fallback text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(state ->> key, ''), fallback);
$$;

CREATE OR REPLACE FUNCTION gw.state_number(state jsonb, key text, fallback double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(state ->> key, '')::double precision, fallback);
$$;

CREATE OR REPLACE FUNCTION gw.edge_topology_multiplier(edge_row gw.routing_edges, state jsonb)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  mode text := gw.state_text(state, 'mode', 'walking');
  mobility text := COALESCE(state #>> '{mobility}', 'ambulant');
BEGIN
  IF edge_row.active_construction THEN
    RETURN 5.0;
  END IF;

  IF mode = 'walking' THEN
    IF edge_row.kind IN ('sidewalk', 'crosswalk', 'trail', 'building_passage') THEN
      RETURN 1.0;
    END IF;
    IF edge_row.kind = 'shared_road' THEN
      RETURN 4.0;
    END IF;
  END IF;

  IF mode IN ('bike', 'ebike', 'scooter') THEN
    IF edge_row.dismount_required THEN
      RETURN 3.0;
    END IF;
    IF edge_row.kind IN ('trail', 'bike_lane_separated') THEN
      RETURN 0.85;
    END IF;
    IF edge_row.bike_facility IN ('trail', 'separated_lane', 'protected_lane') THEN
      RETURN 0.82;
    END IF;
    IF edge_row.bike_facility IN ('bike_boulevard', 'neighborhood_greenway') THEN
      RETURN 0.92;
    END IF;
    IF edge_row.kind = 'bike_lane_painted' THEN
      RETURN 1.1;
    END IF;
    IF edge_row.bike_facility = 'painted_lane' THEN
      RETURN 1.15;
    END IF;
    IF edge_row.kind = 'shared_road' THEN
      RETURN CASE
        WHEN COALESCE(edge_row.adjacent_speed_mph, 25) <= 25 THEN 1.25
        WHEN COALESCE(edge_row.adjacent_speed_mph, 35) <= 35 THEN 1.8
        ELSE 3.0
      END;
    END IF;
    IF edge_row.kind = 'sidewalk' THEN
      RETURN 2.5;
    END IF;
  END IF;

  IF mobility <> 'ambulant' AND edge_row.has_curb_cuts IS FALSE THEN
    RETURN 10.0;
  END IF;

  RETURN 1.4;
END;
$$;

CREATE OR REPLACE FUNCTION gw.edge_exposure_multiplier(edge_row gw.routing_edges, state jsonb)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  mode text := gw.state_text(state, 'mode', 'walking');
  feels_like double precision := COALESCE((state #>> '{weather,feels_like_f}')::double precision, 72.0);
  heat_load double precision := 0.0;
  shade double precision := GREATEST(0.0, LEAST(1.0, edge_row.shade_summer));
  hvi double precision := COALESCE(edge_row.hvi_quantile, edge_row.hvi_score, 0.0);
  mode_factor double precision := CASE WHEN mode = 'walking' THEN 1.0 WHEN mode IN ('bike','ebike','scooter') THEN 0.45 ELSE 0.2 END;
BEGIN
  IF feels_like BETWEEN 60 AND 85 THEN
    RETURN 1.0;
  END IF;

  IF feels_like > 85 THEN
    heat_load := ((feels_like - 85.0) / 25.0) * (1.0 - shade) * (1.0 + hvi);
    RETURN GREATEST(1.0, 1.0 + heat_load * mode_factor);
  END IF;

  IF feels_like < 35 THEN
    RETURN GREATEST(1.0, 1.0 + ((35.0 - feels_like) / 35.0) * mode_factor);
  END IF;

  RETURN 1.0;
END;
$$;

CREATE OR REPLACE FUNCTION gw.edge_safety_multiplier(edge_row gw.routing_edges, state jsonb)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  time_of_day text := COALESCE(state #>> '{time_of_day}', 'afternoon');
  main_roads_comfort double precision := COALESCE((state #>> '{comfort,main_roads}')::double precision, 0.5);
  penalty double precision := 1.0;
BEGIN
  IF time_of_day IN ('night', 'late_night') AND edge_row.lighting IN ('none', 'unknown') THEN
    penalty := penalty * 1.5;
  END IF;

  IF COALESCE(edge_row.adjacent_speed_mph, 0) >= 40 AND main_roads_comfort < 0.7 THEN
    penalty := penalty * (1.0 + (40.0 - 40.0 + COALESCE(edge_row.adjacent_speed_mph, 40) - 30.0) / 60.0);
  END IF;

  IF gw.state_text(state, 'mode', 'walking') IN ('bike', 'ebike', 'scooter') THEN
    IF edge_row.bike_stress_score IS NOT NULL THEN
      penalty := penalty * GREATEST(0.8, LEAST(3.0, edge_row.bike_stress_score));
    ELSIF edge_row.bike_comfort_class IN ('high_stress', 'avoid') THEN
      penalty := penalty * 2.2;
    ELSIF edge_row.bike_comfort_class IN ('low_stress', 'comfortable') THEN
      penalty := penalty * 0.9;
    END IF;
  END IF;

  IF edge_row.active_construction THEN
    penalty := penalty * 2.0;
  END IF;

  RETURN penalty;
END;
$$;

CREATE OR REPLACE FUNCTION gw.edge_surface_multiplier(edge_row gw.routing_edges, state jsonb)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  mobility text := COALESCE(state #>> '{mobility}', 'ambulant');
  load text := COALESCE(state #>> '{load}', 'none');
  surface text := COALESCE(edge_row.surface, 'unknown');
BEGIN
  IF surface IN ('concrete', 'asphalt', 'paved') THEN
    RETURN 1.0;
  END IF;

  IF surface IN ('gravel', 'dirt', 'grass') THEN
    IF mobility <> 'ambulant' THEN
      RETURN 3.0;
    END IF;
    IF load IN ('laundry', 'cart', 'heavy') THEN
      RETURN 1.8;
    END IF;
    RETURN 1.4;
  END IF;

  IF mobility <> 'ambulant' THEN
    RETURN 1.5;
  END IF;

  RETURN 1.05;
END;
$$;

CREATE OR REPLACE FUNCTION gw.edge_amenity_attraction(edge_row gw.routing_edges, state jsonb)
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  WITH nearby AS (
    SELECT
      a.kind,
      ST_Distance(a.geom::geography, edge_row.geom::geography) AS distance_m
    FROM gw.amenity_nodes a
    WHERE a.visibility = 'public'
      AND ST_DWithin(a.geom::geography, edge_row.geom::geography, 120)
  ),
  scored AS (
    SELECT
      CASE
        WHEN kind IN ('water_fountain', 'restroom_public', 'library') AND COALESCE((state #>> '{weather,feels_like_f}')::double precision, 72) > 85 THEN 0.9
        WHEN kind IN ('shade_natural', 'shade_built', 'park', 'garden') AND COALESCE((state #>> '{weather,feels_like_f}')::double precision, 72) > 85 THEN 0.8
        WHEN kind IN ('rest_seat', 'restroom_public') AND COALESCE((state #>> '{group,has_elder}')::boolean, false) THEN 0.8
        WHEN kind IN ('playground', 'splash_pad') AND COALESCE((state #>> '{group,has_child}')::boolean, false) THEN 0.8
        WHEN kind IN ('bike_rack', 'bike_repair_stand', 'bike_share_station') AND COALESCE(state ->> 'mode', 'walking') IN ('bike', 'ebike', 'scooter') THEN 0.55
        WHEN kind IN ('coffee', 'bakery', 'public_art', 'mural', 'outdoor_seating') AND COALESCE(state ->> 'intent', 'errand') IN ('recreation', 'wandering', 'day_out') THEN 0.45
        ELSE 0.0
      END * GREATEST(0.0, 1.0 - distance_m / 120.0) AS score
    FROM nearby
  )
  SELECT LEAST(0.25 * edge_row.length_m, COALESCE(SUM(score), 0) * 0.18 * edge_row.length_m)
  FROM scored;
$$;

CREATE OR REPLACE FUNCTION gw.edge_cost(edge_id bigint, state jsonb DEFAULT '{}'::jsonb)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  edge_row gw.routing_edges;
  raw_cost double precision;
  attraction double precision;
BEGIN
  SELECT * INTO edge_row FROM gw.routing_edges WHERE id = edge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown edge_id %', edge_id;
  END IF;

  raw_cost :=
    edge_row.length_m
    * gw.edge_topology_multiplier(edge_row, state)
    * gw.edge_exposure_multiplier(edge_row, state)
    * gw.edge_safety_multiplier(edge_row, state)
    * gw.edge_surface_multiplier(edge_row, state);

  attraction := gw.edge_amenity_attraction(edge_row, state);

  RETURN GREATEST(0.1 * edge_row.length_m, raw_cost - attraction);
END;
$$;

CREATE OR REPLACE FUNCTION gw.route_walk(
  origin_lon double precision,
  origin_lat double precision,
  dest_lon double precision,
  dest_lat double precision,
  state jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  seq integer,
  edge_id bigint,
  node_id bigint,
  cost double precision,
  agg_cost double precision,
  geom geometry(LineString, 4326)
)
LANGUAGE sql
STABLE
AS $$
  WITH nearest AS (
    SELECT
      (
        SELECT id FROM gw.routing_nodes
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326)
        LIMIT 1
      ) AS start_node,
      (
        SELECT id FROM gw.routing_nodes
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(dest_lon, dest_lat), 4326)
        LIMIT 1
      ) AS end_node
  ),
  route AS (
    SELECT *
    FROM nearest n,
    pgr_dijkstra(
      'SELECT id, from_node AS source, to_node AS target, gw.edge_cost(id, ' || quote_literal(state::text) || '::jsonb) AS cost FROM gw.routing_edges WHERE from_node IS NOT NULL AND to_node IS NOT NULL',
      n.start_node,
      n.end_node,
      directed := false
    )
  )
  SELECT
    route.seq,
    route.edge::bigint AS edge_id,
    route.node::bigint AS node_id,
    route.cost,
    route.agg_cost,
    e.geom
  FROM route
  LEFT JOIN gw.routing_edges e ON e.id = route.edge
  WHERE route.edge <> -1;
$$;

CREATE OR REPLACE VIEW gw.edge_cost_debug AS
SELECT
  e.id,
  e.kind,
  e.length_m,
  e.surface,
  e.shade_summer,
  e.hvi_score,
  e.hvi_quantile,
  e.active_construction,
  e.community_confidence
FROM gw.routing_edges e;
