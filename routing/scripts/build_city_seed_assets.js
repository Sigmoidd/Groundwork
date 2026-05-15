#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const defaultDownloads = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
const downloadsDir = process.env.GROUNDWORK_DOWNLOADS || defaultDownloads;
const scratchDir = path.join(repoRoot, 'routing', 'data', 'scratch', 'okc_portal_shapes');
const seedOut = path.join(repoRoot, 'assets', 'okc-public-seeds.json');
const layerOut = path.join(repoRoot, 'assets', 'okc-public-layers.json');

const SECTOR_COORDS = {
  Paseo: [35.5224, -97.5261],
  Plaza: [35.5135, -97.5485],
  Midtown: [35.4731, -97.5178],
  Downtown: [35.4676, -97.5164],
  'Innovation District': [35.4829, -97.5039],
  'Capitol Hill': [35.4331, -97.5207],
  'NE 23rd': [35.4932, -97.4701],
  Southside: [35.4206, -97.5178],
};

const SOURCES = [
  { key: 'facilities', zip: 'facilitiesshape.zip', label: 'OKC Facilities', overlay: false, seed: true },
  { key: 'park_amenities', zip: 'parkamenities.zip', label: 'OKC Park Amenities', overlay: false, seed: true },
  { key: 'parks', zip: 'parks.zip', label: 'OKC Parks', overlay: true, seed: true, maxFeatures: 260, maxPoints: 80 },
  { key: 'trails', zip: 'trails.zip', label: 'OKC Trails', overlay: true, seed: false, maxFeatures: 80, maxPoints: 180 },
  { key: 'active_pedestrian_projects', zip: 'activepedestrianprojects.zip', label: 'Active Pedestrian Projects', overlay: true, seed: false, maxFeatures: 260, maxPoints: 120 },
  { key: 'bike_projects', zip: 'bikeprojects.zip', label: 'Bike Projects', overlay: true, seed: false, maxFeatures: 140, maxPoints: 120 },
  { key: 'bike_routes', zip: 'bikeroutes.zip', label: 'Bike Routes', overlay: true, seed: false, maxFeatures: 280, maxPoints: 140 },
  { key: 'hvi_2020', zip: 'HVI2020.zip', label: 'Heat Vulnerability 2020', overlay: true, seed: false, maxFeatures: 260, maxPoints: 70 },
  { key: 'city_boundaries', zip: 'cityboundaries.zip', label: 'City Boundaries', overlay: true, seed: false, maxFeatures: 20, maxPoints: 160 },
  { key: 'neighborhoods', zip: 'neighborhoods.zip', label: 'Neighborhoods', overlay: true, seed: false, maxFeatures: 540, maxPoints: 80 },
  { key: 'lakes', zip: 'lakes.zip', label: 'Lakes', overlay: true, seed: false, maxFeatures: 320, maxPoints: 45, namedOnly: 'Lake_Name' },
  { key: 'streams', zip: 'streams.zip', label: 'Streams', overlay: true, seed: false, maxFeatures: 500, maxPoints: 60, namedOnly: 'Stream_Nam' },
  { key: 'riparian_areas', zip: 'riparianareas.zip', label: 'Riparian Areas', overlay: true, seed: false, maxFeatures: 280, maxPoints: 45 },
];

function main() {
  fs.mkdirSync(scratchDir, { recursive: true });
  const allSeeds = [];
  const layerFeatures = [];
  const summary = [];

  for (const source of SOURCES) {
    const zipPath = path.join(downloadsDir, source.zip);
    if (!fs.existsSync(zipPath)) {
      summary.push({ key: source.key, status: 'missing', zip: source.zip });
      continue;
    }

    const extractDir = path.join(scratchDir, source.key);
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('tar', ['-xf', zipPath, '-C', extractDir], { stdio: 'ignore' });

    const files = fs.readdirSync(extractDir);
    const shp = files.find(file => file.toLowerCase().endsWith('.shp'));
    const dbf = files.find(file => file.toLowerCase().endsWith('.dbf'));
    if (!shp || !dbf) {
      summary.push({ key: source.key, status: 'invalid', zip: source.zip });
      continue;
    }

    const records = readDbf(path.join(extractDir, dbf));
    const shapes = readShp(path.join(extractDir, shp));
    const count = Math.min(records.length, shapes.length);

    let overlayCount = 0;
    let seedCount = 0;
    for (let index = 0; index < count; index += 1) {
      const props = records[index] || {};
      const shape = shapes[index];
      if (!shape) continue;

      if (source.overlay && shouldIncludeOverlayFeature(source, props, overlayCount)) {
        const geometry = toGeoJsonGeometry(shape, source.maxPoints || 100);
        if (geometry) {
          layerFeatures.push({
            type: 'Feature',
            id: `${source.key}:${getObjectId(props, index)}`,
            properties: buildLayerProperties(source, props),
            geometry,
          });
          overlayCount += 1;
        }
      }

      if (source.seed) {
        const seed = buildSeedResource(source, props, shape, index);
        if (seed) {
          allSeeds.push(seed);
          seedCount += 1;
        }
      }
    }

    summary.push({
      key: source.key,
      status: 'ok',
      zip: source.zip,
      records: count,
      overlay_features: overlayCount,
      seed_resources: seedCount,
    });
  }

  allSeeds.sort((a, b) => a.placeName.localeCompare(b.placeName) || a.id.localeCompare(b.id));

  const generatedAt = new Date().toISOString();
  writeJson(seedOut, {
    version: 1,
    generatedAt,
    source: 'OKC portal shapefile exports plus curated Groundwork resource mapping',
    records: allSeeds,
  });
  writeJson(layerOut, {
    type: 'FeatureCollection',
    version: 1,
    generatedAt,
    source: 'OKC portal shapefile exports simplified for browser display',
    summary,
    features: layerFeatures,
  });

  console.log(JSON.stringify({
    seedOut,
    layerOut,
    seeds: allSeeds.length,
    layerFeatures: layerFeatures.length,
    summary,
  }, null, 2));
}

function shouldIncludeOverlayFeature(source, props, currentCount) {
  if (source.maxFeatures && currentCount >= source.maxFeatures) return false;
  if (!source.namedOnly) return true;
  return Boolean(String(props[source.namedOnly] || '').trim());
}

function buildLayerProperties(source, props) {
  const name = firstPresent(props, [
    'Park_Name', 'Trail_Name', 'Project_Na', 'Name', 'Associatio', 'City_Name',
    'Lake_Name', 'Stream_Nam', 'Riparian_A', 'Object_ID', 'OBJECT_ID',
  ]);
  const status = firstPresent(props, ['Park_Statu', 'Trail_Stat', 'Project_St']);
  const type = firstPresent(props, ['Park_Type', 'Trail_Type', 'Project_Ty', 'Type']);
  const zScore = firstPresent(props, ['Z_Score']);

  return {
    layer: source.key,
    layerLabel: source.label,
    name: name || source.label,
    status,
    type,
    zScore: zScore === '' ? null : asNumber(zScore),
  };
}

function buildSeedResource(source, props, shape, index) {
  const center = shapeCentroid(shape);
  if (!center) return null;
  const [lng, lat] = projectPoint(center[0], center[1]);
  if (!isInOkcFrame(lat, lng)) return null;

  if (source.key === 'facilities') return seedFromFacility(source, props, index, lat, lng);
  if (source.key === 'park_amenities') return seedFromParkAmenity(source, props, index, lat, lng);
  if (source.key === 'parks') return seedFromPark(source, props, index, lat, lng);
  return null;
}

function seedFromFacility(source, props, index, lat, lng) {
  const type = String(props.Type || '').trim();
  const klass = String(props.Class || '').trim();
  const label = `${klass} ${type}`.toLowerCase();
  const mapped = mapFacilityResource(label);
  if (!mapped) return null;

  const name = firstPresent(props, ['Name']) || titleCase(type || klass || 'OKC facility');
  const address = buildAddress(props);
  return buildSeed(source, props, index, {
    lat, lng,
    resource: mapped.resource,
    note: mapped.note(name, type || klass),
    placeName: name,
    address,
    access: 'public',
    accessibility: mapped.accessibility || defaultAccessibility(),
    sourceType: type || klass,
  });
}

function seedFromParkAmenity(source, props, index, lat, lng) {
  const amenityType = String(props.Amenity_Ty || '').trim();
  const feature = String(props.Amenity_Fe || '').trim();
  const mapped = mapParkAmenityResource(`${amenityType} ${feature}`.toLowerCase());
  if (!mapped) return null;

  const park = firstPresent(props, ['Park']) || 'OKC park';
  const address = firstPresent(props, ['Address']) || '';
  return buildSeed(source, props, index, {
    lat, lng,
    resource: mapped.resource,
    note: mapped.note(park, amenityType || feature),
    placeName: park,
    address,
    access: 'public',
    accessibility: mapped.accessibility || defaultAccessibility(),
    sourceType: amenityType || feature,
  });
}

function seedFromPark(source, props, index, lat, lng) {
  const name = firstPresent(props, ['Park_Name']) || 'OKC park';
  const status = firstPresent(props, ['Park_Statu']);
  if (/^\(private\)/i.test(name)) return null;
  if (status && !/open/i.test(status)) return null;
  return buildSeed(source, props, index, {
    lat, lng,
    resource: 'shade',
    note: `${name} park area from OKC public data`,
    placeName: name,
    address: '',
    access: 'public',
    accessibility: defaultAccessibility(),
    sourceType: firstPresent(props, ['Park_Type']) || 'Park',
  });
}

function buildSeed(source, props, index, extra) {
  const objectId = getObjectId(props, index);
  return {
    id: `city:${source.key}:${objectId}`,
    sourceLayer: source.key,
    sourceLabel: source.label,
    sourceObjectId: String(objectId),
    sector: nearestSector(extra.lat, extra.lng),
    alias: 'OKC public data',
    createdAt: '2026-05-14T00:00:00.000Z',
    ...extra,
    lat: roundCoord(extra.lat),
    lng: roundCoord(extra.lng),
  };
}

function mapFacilityResource(label) {
  if (/\b(drinking fountain|water fountain|dog drinking|sprayground|spraymist|swimming pool|aquatic)\b/.test(label)) {
    return { resource: 'water', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(restroom|portable restroom)\b/.test(label)) {
    return { resource: 'restroom', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(bicycle rack|bicycle repair)\b/.test(label)) {
    return { resource: 'bike_rack', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(trash receptacle|recycle receptacle|pet waste)\b/.test(label)) {
    return { resource: 'trash_can', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(shelter|pavilion|shade)\b/.test(label)) {
    return { resource: 'shade', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(fishing dock|fishing pier|floating pier|pier|dock|boat ramp)\b/.test(label)) {
    return { resource: 'fishing', note: (name, type) => `${name}: ${titleCase(type)} from OKC facilities data` };
  }
  if (/\b(recreation|senior|community|health and wellness|performing arts|skate park|playground)\b/.test(label)) {
    return { resource: 'business', note: (name, type) => `${name}: ${titleCase(type)} public facility from OKC data` };
  }
  return null;
}

function mapParkAmenityResource(label) {
  if (/\bshelter\b/.test(label)) {
    return { resource: 'shade', note: (park, type) => `${park}: ${titleCase(type)} from OKC park amenities data` };
  }
  if (/\bpark\b/.test(label)) {
    return { resource: 'garden', note: (park, type) => `${park}: ${titleCase(type)} from OKC park amenities data` };
  }
  return null;
}

function defaultAccessibility() {
  return { adaStatus: 'unknown', wheelchairAccess: 'unknown', pathSurface: 'unknown' };
}

function buildAddress(props) {
  return [
    props.Address,
    props.City,
    props.State,
    props.ZipCode,
  ].map(value => String(value || '').trim()).filter(Boolean).join(', ');
}

function firstPresent(obj, keys) {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function getObjectId(props, index) {
  return firstPresent(props, ['Object_ID', 'OBJECT_ID', 'objectid', 'OBJECTID']) || String(index + 1);
}

function readDbf(filePath) {
  const bytes = fs.readFileSync(filePath);
  const recordCount = bytes.readInt32LE(4);
  const headerLength = bytes.readInt16LE(8);
  const recordLength = bytes.readInt16LE(10);
  const fields = [];
  let offset = 32;
  let fieldStart = 1;

  while (offset < headerLength - 1 && bytes[offset] !== 0x0d) {
    const nameBytes = [];
    for (let i = 0; i < 11 && bytes[offset + i] !== 0; i += 1) nameBytes.push(bytes[offset + i]);
    const name = Buffer.from(nameBytes).toString('ascii');
    const type = String.fromCharCode(bytes[offset + 11]);
    const length = bytes[offset + 16];
    fields.push({ name, type, length, start: fieldStart });
    fieldStart += length;
    offset += 32;
  }

  const records = [];
  for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
    const recordOffset = headerLength + (recordIndex * recordLength);
    if (bytes[recordOffset] === 0x2a) continue;
    const record = {};
    for (const field of fields) {
      const raw = bytes.slice(recordOffset + field.start, recordOffset + field.start + field.length);
      record[field.name] = raw.toString('latin1').replace(/\0/g, '').trim();
    }
    records.push(record);
  }
  return records;
}

function readShp(filePath) {
  const bytes = fs.readFileSync(filePath);
  const shapes = [];
  let offset = 100;
  while (offset + 8 <= bytes.length) {
    const contentLengthBytes = bytes.readInt32BE(offset + 4) * 2;
    const contentOffset = offset + 8;
    const shapeType = bytes.readInt32LE(contentOffset);

    if (shapeType === 0) {
      shapes.push(null);
    } else if (shapeType === 1) {
      shapes.push({
        type: 'Point',
        coordinates: [bytes.readDoubleLE(contentOffset + 4), bytes.readDoubleLE(contentOffset + 12)],
      });
    } else if (shapeType === 3 || shapeType === 5) {
      const numParts = bytes.readInt32LE(contentOffset + 36);
      const numPoints = bytes.readInt32LE(contentOffset + 40);
      const parts = [];
      for (let i = 0; i < numParts; i += 1) parts.push(bytes.readInt32LE(contentOffset + 44 + (i * 4)));
      const pointsOffset = contentOffset + 44 + (numParts * 4);
      const points = [];
      for (let i = 0; i < numPoints; i += 1) {
        const p = pointsOffset + (i * 16);
        points.push([bytes.readDoubleLE(p), bytes.readDoubleLE(p + 8)]);
      }
      const lines = parts.map((start, index) => {
        const end = index + 1 < parts.length ? parts[index + 1] : points.length;
        return points.slice(start, end);
      });
      shapes.push({ type: shapeType === 3 ? 'MultiLineString' : 'MultiPolygon', coordinates: lines });
    } else {
      shapes.push(null);
    }

    offset = contentOffset + contentLengthBytes;
  }
  return shapes;
}

function toGeoJsonGeometry(shape, maxPoints) {
  if (shape.type === 'Point') {
    const [lng, lat] = projectPoint(shape.coordinates[0], shape.coordinates[1]);
    return { type: 'Point', coordinates: [roundCoord(lng), roundCoord(lat)] };
  }
  if (shape.type === 'MultiLineString') {
    const lines = shape.coordinates
      .map(line => simplifyLine(line, maxPoints).map(([x, y]) => {
        const [lng, lat] = projectPoint(x, y);
        return [roundCoord(lng), roundCoord(lat)];
      }))
      .filter(line => line.length >= 2);
    if (!lines.length) return null;
    return lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines };
  }
  if (shape.type === 'MultiPolygon') {
    const rings = shape.coordinates
      .map(ring => closeRing(simplifyLine(ring, maxPoints)).map(([x, y]) => {
        const [lng, lat] = projectPoint(x, y);
        return [roundCoord(lng), roundCoord(lat)];
      }))
      .filter(ring => ring.length >= 4);
    if (!rings.length) return null;
    return { type: 'MultiPolygon', coordinates: rings.map(ring => [ring]) };
  }
  return null;
}

function simplifyLine(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function closeRing(points) {
  if (!points.length) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

function shapeCentroid(shape) {
  if (shape.type === 'Point') return shape.coordinates;
  const points = shape.coordinates.flat(shape.type === 'MultiPolygon' ? 1 : 0);
  if (!points.length) return null;
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

// Inverse NAD83 StatePlane Oklahoma North FIPS 3501 feet.
function projectPoint(xFeet, yFeet) {
  const a = 6378137;
  const f = 1 / 298.257222101004;
  const e = Math.sqrt((2 * f) - (f * f));
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const unit = 0.304800609601219;
  const falseEasting = 1968500 * unit;
  const falseNorthing = 0;
  const x = (xFeet * unit) - falseEasting;
  const y = (yFeet * unit) - falseNorthing;
  const lon0 = -98 * toRad;
  const phi1 = 35.5666666666667 * toRad;
  const phi2 = 36.7666666666667 * toRad;
  const phi0 = 35 * toRad;
  const m1 = lccM(phi1, e);
  const m2 = lccM(phi2, e);
  const t1 = lccT(phi1, e);
  const t2 = lccT(phi2, e);
  const t0 = lccT(phi0, e);
  const n = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
  const F = m1 / (n * Math.pow(t1, n));
  const rho0 = a * F * Math.pow(t0, n);
  const rho = Math.sign(n) * Math.sqrt((x * x) + ((rho0 - y) * (rho0 - y)));
  const theta = Math.atan2(x, rho0 - y);
  const t = Math.pow(rho / (a * F), 1 / n);
  let phi = (Math.PI / 2) - (2 * Math.atan(t));
  for (let i = 0; i < 8; i += 1) {
    const esin = e * Math.sin(phi);
    phi = (Math.PI / 2) - (2 * Math.atan(t * Math.pow((1 - esin) / (1 + esin), e / 2)));
  }
  const lon = lon0 + (theta / n);
  return [lon * toDeg, phi * toDeg];
}

function lccM(phi, e) {
  const sin = Math.sin(phi);
  return Math.cos(phi) / Math.sqrt(1 - (e * e * sin * sin));
}

function lccT(phi, e) {
  const esin = e * Math.sin(phi);
  return Math.tan((Math.PI / 4) - (phi / 2)) / Math.pow((1 - esin) / (1 + esin), e / 2);
}

function nearestSector(lat, lng) {
  let best = 'Downtown';
  let bestDistance = Infinity;
  for (const [sector, coords] of Object.entries(SECTOR_COORDS)) {
    const dLat = lat - coords[0];
    const dLng = lng - coords[1];
    const distance = (dLat * dLat) + (dLng * dLng);
    if (distance < bestDistance) {
      best = sector;
      bestDistance = distance;
    }
  }
  return best;
}

function isInOkcFrame(lat, lng) {
  return lat >= 35.2 && lat <= 35.8 && lng >= -97.9 && lng <= -97.1;
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundCoord(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

main();
