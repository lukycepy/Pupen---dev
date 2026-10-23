const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getArg(name) {
  const i = process.argv.findIndex((x) => x === name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function getEnvFromArgs() {
  const raw = getArg('--env');
  if (!raw) return null;
  const v = String(raw).toLowerCase();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'staging') return 'staging';
  return null;
}

function parseDotEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDotEnv() {
  const repoRoot = process.cwd();
  const env = getEnvFromArgs();

  const files = ['.env', '.env.local'];
  if (env === 'prod') files.push('.env.production', '.env.production.local');
  if (env === 'staging') files.push('.env.staging', '.env.staging.local');

  for (const f of files) {
    const abs = path.join(repoRoot, f);
    const parsed = parseDotEnvFile(abs);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] == null) process.env[k] = String(v);
    }
  }
}

function getDbUrl() {
  loadDotEnv();
  const env = getEnvFromArgs();
  if (env === 'staging') return process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL || null;
  if (env === 'prod') return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL || null;
  return process.env.DATABASE_URL || null;
}

async function withClient(fn) {
  const connectionString = getDbUrl();
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL (or DATABASE_URL_STAGING / DATABASE_URL_PROD with --env)');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

module.exports = { getEnvFromArgs, getDbUrl, withClient };
