const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withClient } = require('./utils');

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

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      migration_key text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function main() {
  const repoRoot = process.cwd();
  const files = [
    ...listSqlFiles(path.join(repoRoot, 'migrace'), 'migrace'),
    ...listSqlFiles(path.join(repoRoot, 'supabase', 'migrations'), 'supabase/migrations'),
  ];

  if (!files.length) {
    console.log('No SQL migrations found.');
    return;
  }

  await withClient(async (client) => {
    await ensureMigrationsTable(client);

    const existingRes = await client.query('select migration_key, checksum from public.schema_migrations');
    const existing = new Map(existingRes.rows.map((r) => [String(r.migration_key), String(r.checksum)]));

    for (const f of files) {
      const sql = fs.readFileSync(f.abs, 'utf8');
      const checksum = sha256(sql);
      const prev = existing.get(f.key);
      if (prev) {
        if (prev !== checksum) {
          throw new Error(`Migration checksum mismatch: ${f.key}`);
        }
        continue;
      }

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (migration_key, checksum) values ($1, $2)', [f.key, checksum]);
        await client.query('commit');
        console.log(`Applied: ${f.key}`);
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }

    console.log('Done.');
  });
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

