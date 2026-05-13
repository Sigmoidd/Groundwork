CREATE OR REPLACE FUNCTION gw.kg_merge_visibility(
  p_left text,
  p_right text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH ranked AS (
    SELECT greatest(
      coalesce(array_position(ARRAY['public', 'matched', 'verified_only', 'private', 'destroy_with_relay']::text[], coalesce(p_left, 'public')), 5),
      coalesce(array_position(ARRAY['public', 'matched', 'verified_only', 'private', 'destroy_with_relay']::text[], coalesce(p_right, 'public')), 5)
    ) AS rank
  )
  SELECT (ARRAY['public', 'matched', 'verified_only', 'private', 'destroy_with_relay']::text[])[rank]
  FROM ranked;
$$;

CREATE OR REPLACE FUNCTION gw.kg_upsert_node(
  p_node_type text,
  p_source_table text,
  p_source_pk text,
  p_label text,
  p_visibility text,
  p_geom geometry,
  p_attrs jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF coalesce(p_source_table, '') <> '' AND coalesce(p_source_pk, '') <> '' THEN
    SELECT id
    INTO v_id
    FROM gw.kg_nodes
    WHERE node_type = p_node_type
      AND source_table = p_source_table
      AND source_pk = p_source_pk
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      UPDATE gw.kg_nodes
      SET label = coalesce(p_label, label),
          visibility = coalesce(p_visibility, visibility),
          geom = p_geom,
          attrs = coalesce(p_attrs, '{}'::jsonb),
          updated_at = now()
      WHERE id = v_id;

      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO gw.kg_nodes (
    node_type,
    source_table,
    source_pk,
    label,
    visibility,
    geom,
    attrs
  )
  VALUES (
    p_node_type,
    coalesce(p_source_table, ''),
    coalesce(p_source_pk, ''),
    coalesce(p_label, ''),
    coalesce(p_visibility, 'public'),
    p_geom,
    coalesce(p_attrs, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION gw.kg_link(
  p_from_node uuid,
  p_relation text,
  p_to_node uuid,
  p_visibility text DEFAULT 'public',
  p_weight double precision DEFAULT 1.0,
  p_attrs jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id
  INTO v_id
  FROM gw.kg_edges
  WHERE from_node = p_from_node
    AND to_node = p_to_node
    AND relation = p_relation
    AND expires_at IS NULL
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE gw.kg_edges
    SET visibility = coalesce(p_visibility, visibility),
        weight = coalesce(p_weight, weight),
        attrs = coalesce(p_attrs, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_id;

    RETURN v_id;
  END IF;

  INSERT INTO gw.kg_edges (
    from_node,
    relation,
    to_node,
    visibility,
    weight,
    attrs
  )
  VALUES (
    p_from_node,
    p_relation,
    p_to_node,
    coalesce(p_visibility, 'public'),
    coalesce(p_weight, 1.0),
    coalesce(p_attrs, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION gw.kg_refresh_routing()
RETURNS TABLE(nodes_upserted integer, edges_upserted integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec record;
  v_from uuid;
  v_to uuid;
BEGIN
  nodes_upserted := 0;
  edges_upserted := 0;

  FOR v_rec IN
    SELECT *
    FROM gw.source_catalog
  LOOP
    PERFORM gw.kg_upsert_node(
      'source',
      'source_catalog',
      v_rec.source_key,
      v_rec.source_name,
      'public',
      NULL::geometry,
      jsonb_build_object(
        'url', v_rec.source_url,
        'license_note', v_rec.license_note,
        'metadata', v_rec.metadata
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.routing_edges
  LOOP
    PERFORM gw.kg_upsert_node(
      'route_edge',
      'routing_edges',
      v_rec.id::text,
      concat_ws(' ', v_rec.kind, 'edge', v_rec.id::text),
      'public',
      v_rec.geom,
      jsonb_build_object(
        'kind', v_rec.kind,
        'length_m', v_rec.length_m,
        'surface', v_rec.surface,
        'bike_facility', v_rec.bike_facility,
        'bike_stress_score', v_rec.bike_stress_score,
        'hvi_quantile', v_rec.hvi_quantile,
        'active_construction', v_rec.active_construction
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.amenity_nodes
  LOOP
    PERFORM gw.kg_upsert_node(
      'amenity',
      'amenity_nodes',
      v_rec.id::text,
      coalesce(nullif(v_rec.name, ''), v_rec.kind),
      v_rec.visibility,
      v_rec.geom,
      jsonb_build_object(
        'kind', v_rec.kind,
        'address', v_rec.address,
        'requires_id', v_rec.requires_id,
        'requires_sobriety', v_rec.requires_sobriety,
        'requires_referral', v_rec.requires_referral,
        'requires_religious_participation', v_rec.requires_religious_participation,
        'walk_in_accepted', v_rec.walk_in_accepted,
        'delight_tags', v_rec.delight_tags
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.hvi_areas
  LOOP
    PERFORM gw.kg_upsert_node(
      'hvi_area',
      'hvi_areas',
      v_rec.id::text,
      concat('HVI area ', v_rec.id::text),
      'public',
      v_rec.geom,
      jsonb_build_object(
        'source', v_rec.source,
        'source_id', v_rec.source_id,
        'study_year', v_rec.study_year,
        'hvi_score', v_rec.hvi_score,
        'hvi_quantile', v_rec.hvi_quantile
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.community_edge_reports
  LOOP
    PERFORM gw.kg_upsert_node(
      'report',
      'community_edge_reports',
      v_rec.id::text,
      v_rec.report_kind,
      'verified_only',
      NULL::geometry,
      jsonb_build_object(
        'edge_id', v_rec.edge_id,
        'report_kind', v_rec.report_kind,
        'report_value', v_rec.report_value,
        'trust_weight', v_rec.trust_weight,
        'status', v_rec.status,
        'expires_at', v_rec.expires_at
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.stewardship_cells
  LOOP
    PERFORM gw.kg_upsert_node(
      'stewardship_cell',
      'stewardship_cells',
      v_rec.id::text,
      v_rec.name,
      v_rec.visibility,
      coalesce(v_rec.geom::geometry, v_rec.seed_geom::geometry),
      jsonb_build_object(
        'cell_key', v_rec.cell_key,
        'capacity_state', v_rec.capacity_state,
        'attrs', v_rec.attrs
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      edge_node.id AS from_node,
      amenity_node.id AS to_node,
      gw.kg_merge_visibility(edge_node.visibility, amenity_node.visibility) AS visibility,
      ST_Distance(re.geom::geography, an.geom::geography) AS distance_m
    FROM gw.routing_edges re
    JOIN gw.kg_nodes edge_node
      ON edge_node.node_type = 'route_edge'
     AND edge_node.source_table = 'routing_edges'
     AND edge_node.source_pk = re.id::text
    JOIN gw.amenity_nodes an
      ON ST_DWithin(re.geom::geography, an.geom::geography, 120)
    JOIN gw.kg_nodes amenity_node
      ON amenity_node.node_type = 'amenity'
     AND amenity_node.source_table = 'amenity_nodes'
     AND amenity_node.source_pk = an.id::text
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'edge_near_amenity',
      v_rec.to_node,
      v_rec.visibility,
      greatest(0.1, 1.0 - (v_rec.distance_m / 120.0)),
      jsonb_build_object('distance_m', v_rec.distance_m)
    );
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      edge_node.id AS from_node,
      hvi_node.id AS to_node,
      ha.hvi_score,
      ha.hvi_quantile
    FROM gw.routing_edges re
    JOIN gw.hvi_areas ha
      ON ST_Intersects(re.geom, ha.geom)
    JOIN gw.kg_nodes edge_node
      ON edge_node.node_type = 'route_edge'
     AND edge_node.source_table = 'routing_edges'
     AND edge_node.source_pk = re.id::text
    JOIN gw.kg_nodes hvi_node
      ON hvi_node.node_type = 'hvi_area'
     AND hvi_node.source_table = 'hvi_areas'
     AND hvi_node.source_pk = ha.id::text
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'edge_in_hvi_area',
      v_rec.to_node,
      'public',
      coalesce(v_rec.hvi_quantile, v_rec.hvi_score, 0.0),
      jsonb_build_object('hvi_score', v_rec.hvi_score, 'hvi_quantile', v_rec.hvi_quantile)
    );
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      report_node.id AS from_node,
      edge_node.id AS to_node,
      cer.report_kind,
      cer.status,
      cer.trust_weight
    FROM gw.community_edge_reports cer
    JOIN gw.kg_nodes report_node
      ON report_node.node_type = 'report'
     AND report_node.source_table = 'community_edge_reports'
     AND report_node.source_pk = cer.id::text
    JOIN gw.kg_nodes edge_node
      ON edge_node.node_type = 'route_edge'
     AND edge_node.source_table = 'routing_edges'
     AND edge_node.source_pk = cer.edge_id::text
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'report_updates_edge',
      v_rec.to_node,
      'verified_only',
      v_rec.trust_weight,
      jsonb_build_object('report_kind', v_rec.report_kind, 'status', v_rec.status)
    );
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      cell_node.id AS from_node,
      edge_node.id AS to_node,
      sc.capacity_state,
      sc.visibility
    FROM gw.stewardship_cells sc
    JOIN gw.routing_edges re
      ON sc.geom IS NOT NULL
     AND ST_Intersects(sc.geom, re.geom)
    JOIN gw.kg_nodes cell_node
      ON cell_node.node_type = 'stewardship_cell'
     AND cell_node.source_table = 'stewardship_cells'
     AND cell_node.source_pk = sc.id::text
    JOIN gw.kg_nodes edge_node
      ON edge_node.node_type = 'route_edge'
     AND edge_node.source_table = 'routing_edges'
     AND edge_node.source_pk = re.id::text
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'cell_contains_edge',
      v_rec.to_node,
      v_rec.visibility,
      CASE v_rec.capacity_state
        WHEN 'under_capacity' THEN 0.7
        WHEN 'over_capacity' THEN 1.3
        ELSE 1.0
      END,
      jsonb_build_object('capacity_state', v_rec.capacity_state)
    );
    edges_upserted := edges_upserted + 1;
  END LOOP;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION gw.kg_refresh_planner()
RETURNS TABLE(nodes_upserted integer, edges_upserted integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec record;
BEGIN
  nodes_upserted := 0;
  edges_upserted := 0;

  FOR v_rec IN
    SELECT *
    FROM gw.places
  LOOP
    PERFORM gw.kg_upsert_node(
      'place',
      'places',
      v_rec.id::text,
      v_rec.name,
      v_rec.visibility,
      v_rec.geom,
      v_rec.attrs
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.planner_events
  LOOP
    PERFORM gw.kg_upsert_node(
      'event',
      'planner_events',
      v_rec.id::text,
      v_rec.title,
      v_rec.visibility,
      v_rec.geom,
      jsonb_build_object(
        'event_key', v_rec.event_key,
        'starts_at', v_rec.starts_at,
        'ends_at', v_rec.ends_at,
        'attrs', v_rec.attrs
      )
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.planner_tasks
  LOOP
    PERFORM gw.kg_upsert_node(
      'task',
      'planner_tasks',
      v_rec.id::text,
      v_rec.title,
      v_rec.visibility,
      NULL::geometry,
      jsonb_build_object('event_id', v_rec.event_id, 'status', v_rec.status, 'attrs', v_rec.attrs)
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.planner_resources
  LOOP
    PERFORM gw.kg_upsert_node(
      'resource',
      'planner_resources',
      v_rec.id::text,
      v_rec.label,
      v_rec.visibility,
      v_rec.geom,
      jsonb_build_object('resource_key', v_rec.resource_key, 'kind', v_rec.kind, 'attrs', v_rec.attrs)
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM gw.need_catalog
  LOOP
    PERFORM gw.kg_upsert_node(
      'need',
      'need_catalog',
      v_rec.id::text,
      v_rec.label,
      v_rec.visibility,
      NULL::geometry,
      jsonb_build_object('need_key', v_rec.need_key, 'attrs', v_rec.attrs)
    );
    nodes_upserted := nodes_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      event_node.id AS from_node,
      place_node.id AS to_node,
      gw.kg_merge_visibility(pe.visibility, p.visibility) AS visibility
    FROM gw.planner_events pe
    JOIN gw.places p
      ON p.id = pe.place_id
    JOIN gw.kg_nodes event_node
      ON event_node.node_type = 'event'
     AND event_node.source_table = 'planner_events'
     AND event_node.source_pk = pe.id::text
    JOIN gw.kg_nodes place_node
      ON place_node.node_type = 'place'
     AND place_node.source_table = 'places'
     AND place_node.source_pk = p.id::text
  LOOP
    PERFORM gw.kg_link(v_rec.from_node, 'event_at_place', v_rec.to_node, v_rec.visibility, 1.0, '{}'::jsonb);
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      event_node.id AS from_node,
      resource_node.id AS to_node,
      gw.kg_merge_visibility(per.visibility, pr.visibility) AS visibility,
      per.attrs
    FROM gw.planner_event_resources per
    JOIN gw.planner_resources pr
      ON pr.id = per.resource_id
    JOIN gw.kg_nodes event_node
      ON event_node.node_type = 'event'
     AND event_node.source_table = 'planner_events'
     AND event_node.source_pk = per.event_id::text
    JOIN gw.kg_nodes resource_node
      ON resource_node.node_type = 'resource'
     AND resource_node.source_table = 'planner_resources'
     AND resource_node.source_pk = per.resource_id::text
  LOOP
    PERFORM gw.kg_link(v_rec.from_node, 'event_requires_resource', v_rec.to_node, v_rec.visibility, 1.0, v_rec.attrs);
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      task_node.id AS from_node,
      resource_node.id AS to_node,
      gw.kg_merge_visibility(ptr.visibility, pr.visibility) AS visibility,
      ptr.attrs
    FROM gw.planner_task_resources ptr
    JOIN gw.planner_resources pr
      ON pr.id = ptr.resource_id
    JOIN gw.kg_nodes task_node
      ON task_node.node_type = 'task'
     AND task_node.source_table = 'planner_tasks'
     AND task_node.source_pk = ptr.task_id::text
    JOIN gw.kg_nodes resource_node
      ON resource_node.node_type = 'resource'
     AND resource_node.source_table = 'planner_resources'
     AND resource_node.source_pk = ptr.resource_id::text
  LOOP
    PERFORM gw.kg_link(v_rec.from_node, 'task_requires_resource', v_rec.to_node, v_rec.visibility, 1.0, v_rec.attrs);
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      amenity_node.id AS from_node,
      need_node.id AS to_node,
      gw.kg_merge_visibility(an.visibility, anl.visibility) AS visibility,
      anl.attrs
    FROM gw.amenity_need_links anl
    JOIN gw.amenity_nodes an
      ON an.id = anl.amenity_id
    JOIN gw.kg_nodes amenity_node
      ON amenity_node.node_type = 'amenity'
     AND amenity_node.source_table = 'amenity_nodes'
     AND amenity_node.source_pk = anl.amenity_id::text
    JOIN gw.kg_nodes need_node
      ON need_node.node_type = 'need'
     AND need_node.source_table = 'need_catalog'
     AND need_node.source_pk = anl.need_id::text
  LOOP
    PERFORM gw.kg_link(v_rec.from_node, 'amenity_serves_need', v_rec.to_node, v_rec.visibility, 1.0, v_rec.attrs);
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      place_node.id AS from_node,
      amenity_node.id AS to_node,
      gw.kg_merge_visibility(p.visibility, an.visibility) AS visibility,
      ST_Distance(p.geom::geography, an.geom::geography) AS distance_m
    FROM gw.places p
    JOIN gw.amenity_nodes an
      ON ST_DWithin(p.geom::geography, an.geom::geography, 80)
    JOIN gw.kg_nodes place_node
      ON place_node.node_type = 'place'
     AND place_node.source_table = 'places'
     AND place_node.source_pk = p.id::text
    JOIN gw.kg_nodes amenity_node
      ON amenity_node.node_type = 'amenity'
     AND amenity_node.source_table = 'amenity_nodes'
     AND amenity_node.source_pk = an.id::text
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'place_has_amenity',
      v_rec.to_node,
      v_rec.visibility,
      greatest(0.1, 1.0 - (v_rec.distance_m / 80.0)),
      jsonb_build_object('distance_m', v_rec.distance_m)
    );
    edges_upserted := edges_upserted + 1;
  END LOOP;

  FOR v_rec IN
    SELECT
      amenity_node.id AS from_node,
      friction_node.id AS to_node,
      an.visibility,
      friction.label
    FROM gw.amenity_nodes an
    CROSS JOIN LATERAL (
      VALUES
        ('requires_id', 'Requires ID', an.requires_id),
        ('requires_sobriety', 'Requires sobriety', an.requires_sobriety),
        ('requires_referral', 'Requires referral', an.requires_referral),
        ('requires_religious_participation', 'Requires religious participation', an.requires_religious_participation)
    ) AS friction(key, label, applies)
    JOIN gw.kg_nodes amenity_node
      ON amenity_node.node_type = 'amenity'
     AND amenity_node.source_table = 'amenity_nodes'
     AND amenity_node.source_pk = an.id::text
    CROSS JOIN LATERAL gw.kg_upsert_node(
      'need',
      'amenity_friction',
      friction.key,
      friction.label,
      'public',
      NULL::geometry,
      '{}'::jsonb
    ) AS friction_node_id(id)
    JOIN gw.kg_nodes friction_node
      ON friction_node.id = friction_node_id.id
    WHERE friction.applies IS TRUE
  LOOP
    PERFORM gw.kg_link(
      v_rec.from_node,
      'amenity_has_friction',
      v_rec.to_node,
      v_rec.visibility,
      1.0,
      jsonb_build_object('label', v_rec.label)
    );
    nodes_upserted := nodes_upserted + 1;
    edges_upserted := edges_upserted + 1;
  END LOOP;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION gw.kg_public_route_explanations(
  p_edge_ids bigint[],
  p_state jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(label text, detail text, priority integer)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_edges AS (
    SELECT re.*, ordered.ordinality
    FROM unnest(p_edge_ids) WITH ORDINALITY AS ordered(edge_id, ordinality)
    JOIN gw.routing_edges re
      ON re.id = ordered.edge_id
  ),
  route_area AS (
    SELECT
      CASE
        WHEN count(*) = 0 THEN NULL::geometry
        ELSE ST_Buffer(ST_Union(geom)::geography, 120)::geometry
      END AS geom
    FROM ordered_edges
  ),
  last_edge AS (
    SELECT geom
    FROM ordered_edges
    ORDER BY ordinality DESC
    LIMIT 1
  ),
  near_public_amenities AS (
    SELECT an.*
    FROM gw.amenity_nodes an
    CROSS JOIN route_area ra
    WHERE ra.geom IS NOT NULL
      AND an.visibility = 'public'
      AND ST_Intersects(an.geom, ra.geom)
  ),
  mode AS (
    SELECT coalesce(nullif(p_state->>'mode', ''), 'walking') AS value
  )
  SELECT *
  FROM (
    SELECT
      'More shade'::text AS label,
      'Keeps you closer to shade where the data shows it.'::text AS detail,
      10 AS priority
    WHERE EXISTS (SELECT 1 FROM ordered_edges WHERE shade_summer >= 0.35)
       OR EXISTS (SELECT 1 FROM near_public_amenities WHERE kind IN ('shade_natural', 'shade_built', 'park', 'library'))

    UNION ALL

    SELECT
      'Passes water'::text AS label,
      'Goes near public water or cooling stops.'::text AS detail,
      20 AS priority
    WHERE EXISTS (SELECT 1 FROM near_public_amenities WHERE kind IN ('water_fountain', 'cooling_center', 'library'))

    UNION ALL

    SELECT
      'Uses calmer bike streets'::text AS label,
      'Prefers trails, separated bike lanes, or lower-stress streets.'::text AS detail,
      30 AS priority
    WHERE EXISTS (SELECT 1 FROM mode WHERE value IN ('bike', 'biking', 'ebike', 'e-bike'))
      AND EXISTS (
        SELECT 1
        FROM ordered_edges
        WHERE bike_facility IN ('trail', 'greenway', 'protected_lane', 'separated_lane', 'bike_lane')
           OR coalesce(bike_stress_score, 1.0) <= 0.35
      )

    UNION ALL

    SELECT
      'Avoids rough sidewalk'::text AS label,
      'Keeps to smoother known paths when the data is available.'::text AS detail,
      40 AS priority
    WHERE EXISTS (SELECT 1 FROM mode WHERE value IN ('walking', 'foot', 'stroll'))
      AND EXISTS (SELECT 1 FROM ordered_edges WHERE kind IN ('sidewalk', 'crosswalk', 'trail'))
      AND NOT EXISTS (
        SELECT 1
        FROM ordered_edges
        WHERE active_construction IS TRUE
           OR surface IN ('gravel', 'dirt', 'grass', 'rough')
      )

    UNION ALL

    SELECT
      'Bike rack near destination'::text AS label,
      'Ends near bike parking, repair, or share infrastructure.'::text AS detail,
      50 AS priority
    WHERE EXISTS (SELECT 1 FROM mode WHERE value IN ('bike', 'biking', 'ebike', 'e-bike'))
      AND EXISTS (
        SELECT 1
        FROM gw.amenity_nodes an
        CROSS JOIN last_edge le
        WHERE an.visibility = 'public'
          AND an.kind IN ('bike_rack', 'bike_repair_stand', 'bike_share_station')
          AND ST_DWithin(an.geom::geography, le.geom::geography, 150)
      )
  ) reasons
  ORDER BY priority;
$$;

CREATE OR REPLACE FUNCTION gw.kg_public_planner_context(
  p_event_id uuid,
  p_radius_m double precision DEFAULT 250
)
RETURNS TABLE(kind text, label text, distance_m double precision, note text)
LANGUAGE sql
STABLE
AS $$
  WITH event_anchor AS (
    SELECT coalesce(pe.geom, ST_PointOnSurface(p.geom)::geometry(Point, 4326)) AS geom
    FROM gw.planner_events pe
    LEFT JOIN gw.places p
      ON p.id = pe.place_id
    WHERE pe.id = p_event_id
      AND pe.visibility = 'public'
      AND (p.id IS NULL OR p.visibility = 'public')
      AND coalesce(pe.geom, ST_PointOnSurface(p.geom)::geometry(Point, 4326)) IS NOT NULL
  ),
  nearby AS (
    SELECT
      an.kind,
      coalesce(nullif(an.name, ''), an.kind) AS label,
      ST_Distance(an.geom::geography, ea.geom::geography) AS distance_m
    FROM event_anchor ea
    JOIN gw.amenity_nodes an
      ON an.visibility = 'public'
     AND ST_DWithin(an.geom::geography, ea.geom::geography, p_radius_m)
    WHERE an.kind IN (
      'water_fountain',
      'shade_natural',
      'shade_built',
      'rest_seat',
      'restroom_public',
      'bike_rack',
      'bike_repair_stand',
      'bike_share_station',
      'library',
      'cooling_center'
    )
  )
  SELECT
    kind,
    label,
    distance_m,
    CASE
      WHEN kind = 'water_fountain' THEN 'Nearby water'
      WHEN kind IN ('shade_natural', 'shade_built') THEN 'Nearby shade'
      WHEN kind IN ('bike_rack', 'bike_repair_stand', 'bike_share_station') THEN 'Bike parking or repair nearby'
      WHEN kind = 'restroom_public' THEN 'Public restroom nearby'
      WHEN kind IN ('library', 'cooling_center') THEN 'Cooling or rest stop nearby'
      ELSE 'Nearby support'
    END AS note
  FROM nearby
  ORDER BY distance_m, kind, label;
$$;
