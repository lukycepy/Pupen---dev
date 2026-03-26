const { Client } = require('pg');

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

function getDbUrl() {
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

