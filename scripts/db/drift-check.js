const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withClient, getDbUrl } = require('./utils');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function listSqlFiles(rootDir, prefix) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => ({ key: `${prefix}/${f}`, abs: path.join(rootDir, f) }));
}

async function main() {
  const url = getDbUrl();
  if (!url) {
    if (process.env.CI) {
      throw new Error('Missing DATABASE_URL (or DATABASE_URL_STAGING / DATABASE_URL_PROD with --env)');
    }
    console.log('SKIPPED: drift-check (no DATABASE_URL provided)');
    return;
  }
  const repoRoot = process.cwd();
  const files = [
    ...listSqlFiles(path.join(repoRoot, 'migrace'), 'migrace'),
    ...listSqlFiles(path.join(repoRoot, 'supabase', 'migrations'), 'supabase/migrations'),
  ];

  await withClient(async (client) => {
    const existsRes = await client.query(
      `select to_regclass('public.schema_migrations') as exists`,
    );
    if (!existsRes.rows[0]?.exists) {
      throw new Error('Missing public.schema_migrations table. Run migrate first.');
    }

    const dbRes = await client.query('select migration_key, checksum from public.schema_migrations');
    const dbMap = new Map(dbRes.rows.map((r) => [String(r.migration_key), String(r.checksum)]));

    const repoKeys = new Set(files.map((f) => f.key));

    const missingInDb = [];
    const changed = [];
    for (const f of files) {
      const sql = fs.readFileSync(f.abs, 'utf8');
      const checksum = sha256(sql);
      const dbChecksum = dbMap.get(f.key);
      if (!dbChecksum) missingInDb.push(f.key);
      else if (dbChecksum !== checksum) changed.push(f.key);
    }

    const missingInRepo = [];
    for (const key of dbMap.keys()) {
      if (!repoKeys.has(key)) missingInRepo.push(key);
    }

    if (missingInDb.length || changed.length || missingInRepo.length) {
      if (missingInDb.length) {
        console.error('Migrations missing in DB:');
        for (const k of missingInDb) console.error(`- ${k}`);
      }
      if (changed.length) {
        console.error('Migrations changed after apply (checksum mismatch):');
        for (const k of changed) console.error(`- ${k}`);
      }
      if (missingInRepo.length) {
        console.error('Migrations applied in DB but missing in repo:');
        for (const k of missingInRepo) console.error(`- ${k}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`OK: ${files.length} migrations match DB.`);
  });
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
