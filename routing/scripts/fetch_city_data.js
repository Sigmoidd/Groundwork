#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultManifestPath = path.join(root, 'data_sources.json');
const defaultRawDir = path.join(root, 'data', 'raw');
const defaultBuildDir = path.join(root, 'build');

function parseArgs(argv) {
  const args = {
    manifest: defaultManifestPath,
    out: defaultRawDir,
    build: defaultBuildDir,
    sources: [],
    withOsm: false,
    withGtfs: false,
    withWeather: false,
    keepGoing: true,
    bbox: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = path.resolve(argv[++i]);
    else if (arg === '--out') args.out = path.resolve(argv[++i]);
    else if (arg === '--build') args.build = path.resolve(argv[++i]);
    else if (arg === '--source') args.sources.push(argv[++i]);
    else if (arg === '--bbox') args.bbox = argv[++i].split(',').map(Number);
    else if (arg === '--with-osm') args.withOsm = true;
    else if (arg === '--with-gtfs') args.withGtfs = true;
    else if (arg === '--with-weather') args.withWeather = true;
    else if (arg === '--fail-fast') args.keepGoing = false;
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node routing/scripts/fetch_city_data.js [options]

Options:
  --source KEY      Fetch one OKC source. Repeat for multiple sources.
  --bbox W,S,E,N    Override manifest bbox in lon,lat order.
  --with-osm        Fetch OSM walk/bike/amenity features from Overpass.
  --with-gtfs       Download the EMBARK static GTFS zip to routing/data/gtfs.
  --with-weather    Fetch the NOAA point metadata for central OKC.
  --fail-fast       Stop on the first failed public source.
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  if (value === null || value === undefined) return 'NULL';
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sourceCatalogRows(manifest) {
  const rows = [];
  for (const source of manifest.okc_open_data || []) {
    rows.push({
      source_key: source.key,
      source_name: source.dataset,
      source_url: source.viewer || source.map_api || source.records_api,
      license_note: 'City of Oklahoma City public portal terms apply; fetch during ingest, do not redistribute raw data.',
      metadata: source,
    });
  }
  for (const source of manifest.external_public_data || []) {
    rows.push({
      source_key: source.key,
      source_name: source.source,
      source_url: source.download || source.api || source.info || '',
      license_note: source.license || source.note || '',
      metadata: source,
    });
  }
  return rows;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://data.okc.gov/portal/page/api',
      'user-agent': 'Mozilla/5.0 GroundworkOKCDataIngest/0.2',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: {
      accept: '*/*',
      'user-agent': 'Mozilla/5.0 GroundworkOKCDataIngest/0.2',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function okcMapUrl(source, bbox) {
  const [west, south, east, north] = bbox;
  const url = new URL(source.map_api);
  url.searchParams.set('minLatitude', String(south));
  url.searchParams.set('maxLatitude', String(north));
  url.searchParams.set('minLongitude', String(west));
  url.searchParams.set('maxLongitude', String(east));
  return url.toString();
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function asNumber(value) {
  if (isNumber(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stripGeometryKeys(item) {
  const skip = new Set([
    'geometry',
    'Geometry',
    'geom',
    'shape',
    'Shape',
    'x',
    'y',
    'lat',
    'latitude',
    'Latitude',
    'LATITUDE',
    'lon',
    'lng',
    'longitude',
    'Longitude',
    'LONGITUDE',
  ]);
  const props = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!skip.has(key)) props[key] = value;
  }
  return props;
}

function esriToGeoJSON(geom) {
  if (!geom || typeof geom !== 'object') return null;
  const x = asNumber(pick(geom, ['x', 'X', 'longitude', 'Longitude']));
  const y = asNumber(pick(geom, ['y', 'Y', 'latitude', 'Latitude']));
  if (x !== null && y !== null) return { type: 'Point', coordinates: [x, y] };
  if (Array.isArray(geom.paths)) {
    if (geom.paths.length === 1) return { type: 'LineString', coordinates: geom.paths[0] };
    return { type: 'MultiLineString', coordinates: geom.paths };
  }
  if (Array.isArray(geom.rings)) {
    return { type: 'Polygon', coordinates: geom.rings };
  }
  return null;
}

function extractGeometry(item) {
  if (!item || typeof item !== 'object') return null;
  const direct = item.geometry || item.Geometry || item.geom || item.shape || item.Shape;
  if (direct?.type && direct?.coordinates) return direct;
  const esri = esriToGeoJSON(direct);
  if (esri) return esri;

  const lon = asNumber(pick(item, ['lon', 'lng', 'longitude', 'Longitude', 'LONGITUDE', 'x', 'X']));
  const lat = asNumber(pick(item, ['lat', 'latitude', 'Latitude', 'LATITUDE', 'y', 'Y']));
  if (lon !== null && lat !== null) return { type: 'Point', coordinates: [lon, lat] };

  const nested = esriToGeoJSON(item);
  if (nested) return nested;

  return null;
}

function extractItems(payload) {
  if (!payload) return [];
  if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) return payload.features;
  if (payload.type === 'Feature') return [payload];
  if (Array.isArray(payload)) return payload;

  const candidateKeys = [
    'features',
    'Features',
    'records',
    'Records',
    'items',
    'Items',
    'results',
    'Results',
    'data',
    'Data',
    'layers',
    'Layers',
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(payload[key]) && payload[key].length) return payload[key];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.some(item => item && typeof item === 'object')) return value;
  }

  return [payload];
}

function featureId(item, sourceKey) {
  const props = item.properties || item.attributes || item;
  return String(
    pick(props, [
      'OBJECTID',
      'objectid',
      'object_id',
      'Object_ID',
      'id',
      'ID',
      'FID',
      'fid',
      'globalid',
      'GlobalID',
    ]) || `${sourceKey}:${stableHash(item)}`
  );
}

function toFeature(item, sourceKey) {
  if (item?.type === 'Feature') {
    const geometry = item.geometry || null;
    return {
      type: 'Feature',
      id: String(item.id || featureId(item, sourceKey)),
      properties: item.properties || {},
      geometry,
      raw: item,
    };
  }

  const properties = item.attributes || item.properties || stripGeometryKeys(item);
  const geometry = extractGeometry(item);
  return {
    type: 'Feature',
    id: featureId(item, sourceKey),
    properties,
    geometry,
    raw: item,
  };
}

function writeFeatureCollection(filePath, sourceKey, features) {
  const collection = {
    type: 'FeatureCollection',
    name: sourceKey,
    features: features.map(feature => ({
      type: 'Feature',
      id: feature.id,
      properties: feature.properties,
      geometry: feature.geometry,
    })),
  };
  fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));
}

async function fetchOkcSource(source, bbox, outDir) {
  const url = okcMapUrl(source, bbox);
  const payload = await fetchJson(url);
  const features = extractItems(payload)
    .map(item => toFeature(item, source.key))
    .filter(feature => feature.geometry);

  const filePath = path.join(outDir, `${source.key}.geojson`);
  writeFeatureCollection(filePath, source.key, features);

  return { source, url, features, filePath };
}

function overpassQuery(bbox) {
  const [west, south, east, north] = bbox;
  return `[out:json][timeout:180];
(
  way["highway"~"footway|path|cycleway|pedestrian|residential|living_street|service|tertiary|secondary|primary|unclassified"](${south},${west},${north},${east});
  way["cycleway"](${south},${west},${north},${east});
  way["bicycle"~"designated|yes"](${south},${west},${north},${east});
  node["amenity"~"bicycle_parking|bicycle_repair_station|drinking_water|toilets"](${south},${west},${north},${east});
  node["leisure"~"park|playground|garden"](${south},${west},${north},${east});
);
(._;>;);
out body;`;
}

async function fetchOverpass(manifest, bbox, outDir) {
  const osmSource = (manifest.external_public_data || []).find(item => item.key === 'osm_okc');
  const endpoint = osmSource?.overpass || 'https://overpass-api.de/api/interpreter';
  const body = new URLSearchParams({ data: overpassQuery(bbox) });
  const payload = await fetchJson(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const rawPath = path.join(outDir, 'osm_walk_bike.overpass.json');
  fs.writeFileSync(rawPath, JSON.stringify(payload, null, 2));

  const nodes = new Map();
  for (const element of payload.elements || []) {
    if (element.type === 'node') nodes.set(element.id, element);
  }

  const features = [];
  for (const element of payload.elements || []) {
    if (element.type === 'node' && element.tags) {
      features.push({
        type: 'Feature',
        id: `osm:node:${element.id}`,
        properties: { ...element.tags, osm_type: 'node', osm_id: element.id },
        geometry: { type: 'Point', coordinates: [element.lon, element.lat] },
        raw: element,
      });
    }
    if (element.type === 'way' && Array.isArray(element.nodes)) {
      const coords = element.nodes
        .map(nodeId => nodes.get(nodeId))
        .filter(Boolean)
        .map(node => [node.lon, node.lat]);
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          id: `osm:way:${element.id}`,
          properties: { ...(element.tags || {}), osm_type: 'way', osm_id: element.id },
          geometry: { type: 'LineString', coordinates: coords },
          raw: element,
        });
      }
    }
  }

  const filePath = path.join(outDir, 'osm_walk_bike.geojson');
  writeFeatureCollection(filePath, 'osm_walk_bike', features);
  return {
    source: { key: 'osm_walk_bike', dataset: 'OpenStreetMap walk/bike extract' },
    url: endpoint,
    features,
    filePath,
  };
}

async function fetchGtfs(manifest, rootOutDir) {
  const source = (manifest.external_public_data || []).find(item => item.key === 'embark_gtfs_static');
  if (!source?.download) return null;
  const gtfsDir = path.join(root, 'data', 'gtfs');
  ensureDir(gtfsDir);
  const buffer = await fetchBuffer(source.download);
  const filePath = path.join(gtfsDir, 'embark_static_gtfs.zip');
  fs.writeFileSync(filePath, buffer);
  return { source, filePath, bytes: buffer.length };
}

async function fetchWeather(outDir) {
  const payload = await fetchJson('https://api.weather.gov/points/35.4676,-97.5164');
  const filePath = path.join(outDir, 'noaa_okc_point.json');
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { filePath };
}

function emitSql(manifest, results, buildDir) {
  ensureDir(buildDir);

  const catalogSql = [
    'BEGIN;',
    ...sourceCatalogRows(manifest).map(row => `INSERT INTO gw.source_catalog (source_key, source_name, source_url, license_note, metadata)
VALUES (${sqlString(row.source_key)}, ${sqlString(row.source_name)}, ${sqlString(row.source_url)}, ${sqlString(row.license_note)}, ${sqlJson(row.metadata)})
ON CONFLICT (source_key) DO UPDATE
SET source_name = excluded.source_name,
    source_url = excluded.source_url,
    license_note = excluded.license_note,
    fetched_at = now(),
    metadata = excluded.metadata;`),
    'COMMIT;',
    '',
  ].join('\n');

  const loadLines = ['BEGIN;'];
  for (const result of results) {
    for (const feature of result.features) {
      loadLines.push(`SELECT gw.import_city_feature(${sqlString(result.source.key)}, ${sqlString(feature.id)}, ${sqlJson(feature.geometry)}, ${sqlJson(feature.properties)}, ${sqlJson(feature.raw)});`);
    }
  }
  loadLines.push('COMMIT;', '');

  fs.writeFileSync(path.join(buildDir, 'source_catalog.sql'), catalogSql);
  fs.writeFileSync(path.join(buildDir, 'load_city_features.sql'), loadLines.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson(args.manifest);
  const bbox = args.bbox || manifest.city_bounds?.bbox_lon_lat;
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(value => !Number.isFinite(value))) {
    throw new Error('Missing bbox. Provide --bbox W,S,E,N or city_bounds.bbox_lon_lat in data_sources.json.');
  }

  ensureDir(args.out);
  ensureDir(args.build);

  const wanted = new Set(args.sources);
  const okcSources = (manifest.okc_open_data || [])
    .filter(source => wanted.size === 0 || wanted.has(source.key));
  const results = [];
  const failures = [];

  for (const source of okcSources) {
    process.stdout.write(`Fetching ${source.key}... `);
    try {
      const result = await fetchOkcSource(source, bbox, args.out);
      results.push(result);
      process.stdout.write(`${result.features.length} features\n`);
    } catch (error) {
      failures.push({ source: source.key, error: error.message });
      process.stdout.write(`failed: ${error.message}\n`);
      if (!args.keepGoing) break;
    }
  }

  if (args.withOsm) {
    process.stdout.write('Fetching osm_walk_bike... ');
    try {
      const result = await fetchOverpass(manifest, bbox, args.out);
      results.push(result);
      process.stdout.write(`${result.features.length} features\n`);
    } catch (error) {
      failures.push({ source: 'osm_walk_bike', error: error.message });
      process.stdout.write(`failed: ${error.message}\n`);
    }
  }

  if (args.withGtfs) {
    process.stdout.write('Downloading EMBARK GTFS... ');
    try {
      const result = await fetchGtfs(manifest, args.out);
      process.stdout.write(result ? `${result.bytes} bytes\n` : 'skipped\n');
    } catch (error) {
      failures.push({ source: 'embark_gtfs_static', error: error.message });
      process.stdout.write(`failed: ${error.message}\n`);
    }
  }

  if (args.withWeather) {
    process.stdout.write('Fetching NOAA OKC point... ');
    try {
      await fetchWeather(args.out);
      process.stdout.write('ok\n');
    } catch (error) {
      failures.push({ source: 'noaa_weather', error: error.message });
      process.stdout.write(`failed: ${error.message}\n`);
    }
  }

  emitSql(manifest, results, args.build);
  fs.writeFileSync(
    path.join(args.build, 'fetch_summary.json'),
    JSON.stringify({
      fetched_at: new Date().toISOString(),
      feature_sources: results.map(result => ({
        key: result.source.key,
        count: result.features.length,
        file: path.relative(root, result.filePath),
      })),
      failures,
    }, null, 2)
  );

  if (failures.length) {
    console.error(`Completed with ${failures.length} failed source(s). See routing/build/fetch_summary.json.`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
