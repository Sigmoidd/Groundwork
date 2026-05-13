param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  throw "Set DATABASE_URL or pass -DatabaseUrl before running."
}

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

node routing\scripts\fetch_city_data.js --with-osm --with-weather

psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\schema.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\city_data_ingest.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\build\source_catalog.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\build\load_city_features.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\cost_function.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f routing\knowledge_graph.sql
psql $DatabaseUrl -v ON_ERROR_STOP=1 -c "SELECT * FROM gw.normalize_city_data();"
psql $DatabaseUrl -v ON_ERROR_STOP=1 -c "SELECT * FROM gw.kg_refresh_routing();"

Write-Host "Groundwork OKC routing data seed complete."
