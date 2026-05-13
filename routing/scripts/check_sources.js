#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'data_sources.json');
const outputDir = path.join(root, 'source_check');

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'GroundworkOKC-routing-source-check/0.1'
    }
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function checkSource(source) {
  const schemaUrl = `${source.records_api}?schemaOnly=true`;
  const sampleUrl = `${source.records_api}?recordID=-1`;
  const result = {
    key: source.key,
    dataset: source.dataset,
    records_api: source.records_api,
    map_api: source.map_api,
    schema_ok: false,
    sample_ok: false,
    schema_keys: [],
    sample_shape: '',
    error: ''
  };

  try {
    const schema = await fetchJson(schemaUrl);
    result.schema_ok = true;
    result.schema_keys = Object.keys(schema || {}).slice(0, 30);
    fs.writeFileSync(
      path.join(outputDir, `${source.key}.schema.json`),
      JSON.stringify(schema, null, 2)
    );
  } catch (err) {
    result.error = `schema: ${err.message}`;
    return result;
  }

  try {
    const sample = await fetchJson(sampleUrl);
    result.sample_ok = true;
    result.sample_shape = Array.isArray(sample)
      ? `array:${sample.length}`
      : `object:${Object.keys(sample || {}).slice(0, 12).join(',')}`;
    fs.writeFileSync(
      path.join(outputDir, `${source.key}.sample.json`),
      JSON.stringify(sample, null, 2)
    );
  } catch (err) {
    result.error = `sample: ${err.message}`;
  }

  return result;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const manifest = readManifest();
  const sources = manifest.okc_open_data || [];
  const results = [];

  for (const source of sources) {
    process.stdout.write(`Checking ${source.key}... `);
    const result = await checkSource(source);
    results.push(result);
    process.stdout.write(result.schema_ok ? 'schema ok' : 'schema failed');
    process.stdout.write(result.sample_ok ? ', sample ok\n' : `, sample skipped/failed\n`);
  }

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2)
  );

  const failed = results.filter(item => !item.schema_ok);
  if (failed.length) {
    console.error(`Failed sources: ${failed.map(item => item.key).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
