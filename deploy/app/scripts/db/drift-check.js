const fs = require('fs');
const path = require('path');
const { withClient, getDbUrl } = require('./utils');

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
  const files = listSqlFiles(path.join(repoRoot, 'supabase', 'migrations'), 'supabase/migrations');

  await withClient(async (client) => {
    const existsRes = await client.query(
      `select to_regclass('supabase_migrations.schema_migrations') as exists`,
    );
    if (!existsRes.rows[0]?.exists) {
      throw new Error('Missing supabase_migrations.schema_migrations table. Run Supabase migrations first.');
    }

    const dbRes = await client.query('select version::text as version, name::text as name from supabase_migrations.schema_migrations');
    const dbVersions = new Map(dbRes.rows.map((r) => [String(r.version), String(r.name || '')]));

    const missingInDb = [];
    for (const f of files) {
      const base = path.basename(f.abs);
      const version = String(base.split('_')[0] || '').trim();
      if (!version || !/^\d{12,14}$/.test(version)) continue;
      if (!dbVersions.has(version)) missingInDb.push(f.key);
    }

    const missingInRepo = [];
    for (const [version, name] of dbVersions.entries()) {
      const expected = files.find((f) => path.basename(f.abs).startsWith(`${version}_`));
      if (!expected) missingInRepo.push(`${version}${name ? `_${name}` : ''}`);
    }

    const nameMismatches = [];
    for (const f of files) {
      const base = path.basename(f.abs);
      const version = String(base.split('_')[0] || '').trim();
      if (!version || !/^\d{12,14}$/.test(version)) continue;
      const dbName = dbVersions.get(version);
      if (!dbName) continue;
      const repoName = base.replace(/^\d{12,14}_/, '').replace(/\.sql$/i, '');
      if (dbName && repoName && dbName !== repoName) nameMismatches.push(`${version}: db="${dbName}" repo="${repoName}"`);
    }

    if (missingInDb.length || missingInRepo.length || nameMismatches.length) {
      if (missingInDb.length) {
        console.error('Migrations missing in DB:');
        for (const k of missingInDb) console.error(`- ${k}`);
      }
      if (missingInRepo.length) {
        console.error('Migrations applied in DB but missing in repo:');
        for (const k of missingInRepo) console.error(`- ${k}`);
      }
      if (nameMismatches.length) {
        console.error('Migration name mismatches (Supabase stores version+name):');
        for (const k of nameMismatches) console.error(`- ${k}`);
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
