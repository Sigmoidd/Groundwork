INSERT INTO gw.route_benchmark_pairs (id, label, origin, destination, state, expected_note)
VALUES
  (
    'plaza_walk_default',
    'Plaza short default walk',
    ST_SetSRID(ST_MakePoint(-97.5485, 35.5135), 4326),
    ST_SetSRID(ST_MakePoint(-97.5459, 35.5118), 4326),
    '{"mode":"walking","intent":"errand","weather":{"feels_like_f":72},"mobility":"ambulant"}'::jsonb,
    'Should remain close to shortest path on benign day.'
  ),
  (
    'plaza_walk_hot',
    'Plaza hot-day walk',
    ST_SetSRID(ST_MakePoint(-97.5485, 35.5135), 4326),
    ST_SetSRID(ST_MakePoint(-97.5459, 35.5118), 4326),
    '{"mode":"walking","intent":"errand","weather":{"feels_like_f":103},"mobility":"ambulant"}'::jsonb,
    'Should prefer shaded/lower-HVI edges where reasonable.'
  ),
  (
    'midtown_step_free',
    'Midtown step-free path',
    ST_SetSRID(ST_MakePoint(-97.5178, 35.4731), 4326),
    ST_SetSRID(ST_MakePoint(-97.5145, 35.4762), 4326),
    '{"mode":"walking","intent":"errand","weather":{"feels_like_f":80},"mobility":"rolling"}'::jsonb,
    'Should strongly avoid edges without curb cuts.'
  ),
  (
    'capitol_hill_laundry',
    'Capitol Hill laundry load walk',
    ST_SetSRID(ST_MakePoint(-97.5207, 35.4331), 4326),
    ST_SetSRID(ST_MakePoint(-97.5168, 35.4320), 4326),
    '{"mode":"walking","intent":"errand","load":"laundry","weather":{"feels_like_f":96},"mobility":"ambulant"}'::jsonb,
    'Should prefer smoother surfaces and pass water/shade if reasonable.'
  ),
  (
    'midtown_bike_default',
    'Midtown bike/e-bike default route',
    ST_SetSRID(ST_MakePoint(-97.5178, 35.4731), 4326),
    ST_SetSRID(ST_MakePoint(-97.5485, 35.5135), 4326),
    '{"mode":"ebike","intent":"errand","weather":{"feels_like_f":78},"mobility":"ambulant"}'::jsonb,
    'Should prefer trails, bike routes, lower-speed streets, and avoid high-stress shared roads.'
  ),
  (
    'paseo_bike_recreation',
    'Paseo bike/e-bike recreation loop seed',
    ST_SetSRID(ST_MakePoint(-97.5261, 35.5224), 4326),
    ST_SetSRID(ST_MakePoint(-97.5485, 35.5135), 4326),
    '{"mode":"bike","intent":"recreation","delight_preferences":["coffee","public_art","bike_rack"],"weather":{"feels_like_f":84},"mobility":"ambulant"}'::jsonb,
    'Should favor low-stress bike facilities and pass bike racks or casual-good amenities.'
  )
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  origin = EXCLUDED.origin,
  destination = EXCLUDED.destination,
  state = EXCLUDED.state,
  expected_note = EXCLUDED.expected_note;
