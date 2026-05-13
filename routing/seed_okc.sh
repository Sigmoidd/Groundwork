#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to the Postgres/PostGIS database before running." >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node routing/scripts/fetch_city_data.js --with-osm --with-weather

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/city_data_ingest.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/build/source_catalog.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/build/load_city_features.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/cost_function.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f routing/knowledge_graph.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM gw.normalize_city_data();"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM gw.kg_refresh_routing();"

echo "Groundwork OKC routing data seed complete."
