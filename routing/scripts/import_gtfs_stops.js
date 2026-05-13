#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultGtfsDir = path.join(root, 'data', 'gtfs', 'extracted');
const defaultBuildDir = path.join(root, 'build');

function parseArgs(argv) {
  const args = { gtfsDir: defaultGtfsDir, build: defaultBuildDir };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--gtfs-dir') args.gtfsDir = path.resolve(argv[++i]);
    else if (arg === '--build') args.build = path.resolve(argv[++i]);
    else if (arg === '--help') {
      console.log('Usage: node routing/scripts/import_gtfs_stops.js [--gtfs-dir DIR] [--build DIR]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stopsPath = path.join(args.gtfsDir, 'stops.txt');
  if (!fs.existsSync(stopsPath)) {
    throw new Error(`Missing ${stopsPath}. Extract the GTFS zip first.`);
  }
  fs.mkdirSync(args.build, { recursive: true });

  const rows = parseCsv(fs.readFileSync(stopsPath, 'utf8'));
  const sql = ['BEGIN;'];
  for (const row of rows) {
    const lon = Number(row.stop_lon);
    const lat = Number(row.stop_lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const stopId = row.stop_id || `${lon},${lat}`;
    const geometry = { type: 'Point', coordinates: [lon, lat] };
    const properties = {
      ...row,
      name: row.stop_name || row.stop_desc || stopId,
      gtfs_kind: 'stop',
    };
    sql.push(`SELECT gw.import_city_feature('embark_gtfs_static', ${sqlString(stopId)}, ${sqlJson(geometry)}, ${sqlJson(properties)}, ${sqlJson(row)});`);
  }
  sql.push('COMMIT;', '');

  fs.writeFileSync(path.join(args.build, 'load_gtfs_stops.sql'), sql.join('\n'));
  console.log(`Wrote ${rows.length} GTFS stop rows to ${path.join(args.build, 'load_gtfs_stops.sql')}`);
}

main();
