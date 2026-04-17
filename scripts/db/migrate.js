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

function parseSupabaseMigration(f) {
  const base = path.basename(f.abs);
  const version = String(base.split('_')[0] || '').trim();
  if (!version || !/^\d{12,14}$/.test(version)) return null;
  const name = base.replace(/^\d{12,14}_/, '').replace(/\.sql$/i, '');
  return { version, name };
}

async function ensureSupabaseMigrationsTable(client) {
  const existsRes = await client.query(`select to_regclass('supabase_migrations.schema_migrations') as exists`);
  if (!existsRes.rows[0]?.exists) {
    throw new Error('Missing supabase_migrations.schema_migrations table. Create it via Supabase first.');
  }
}

async function supabaseMigrationIsApplied(client, version) {
  const res = await client.query(
    'select 1 from supabase_migrations.schema_migrations where version::text = $1 limit 1',
    [String(version)],
  );
  return !!res.rows?.length;
}

async function markSupabaseMigrationApplied(client, version, name, sql) {
  const colsRes = await client.query(
    `
      select column_name::text as name, is_nullable::text as nullable, column_default::text as def
      from information_schema.columns
      where table_schema='supabase_migrations' and table_name='schema_migrations'
    `,
  );
  const cols = new Set(colsRes.rows.map((r) => String(r.name)));

  const insertCols = ['version'];
  const values = [String(version)];
  if (cols.has('name')) {
    insertCols.push('name');
    values.push(String(name || ''));
  }
  if (cols.has('statements')) {
    insertCols.push('statements');
    values.push([String(sql || '')]);
  }

  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
  const sqlText = `insert into supabase_migrations.schema_migrations (${insertCols.join(
    ', ',
  )}) values (${placeholders}) on conflict (version) do nothing`;
  await client.query(sqlText, values);
}

async function main() {
  const repoRoot = process.cwd();
  const customFiles = listSqlFiles(path.join(repoRoot, 'migrace'), 'migrace');
  const supabaseFiles = listSqlFiles(path.join(repoRoot, 'supabase', 'migrations'), 'supabase/migrations');

  if (!customFiles.length && !supabaseFiles.length) {
    console.log('No SQL migrations found.');
    return;
  }

  await withClient(async (client) => {
    await ensureMigrationsTable(client);

    const existingRes = await client.query('select migration_key, checksum from public.schema_migrations');
    const existing = new Map(existingRes.rows.map((r) => [String(r.migration_key), String(r.checksum)]));

    for (const f of customFiles) {
      const sql = fs.readFileSync(f.abs, 'utf8');
      if (!sql.trim()) {
        throw new Error(`Empty migration file: ${f.key}`);
      }
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

    if (supabaseFiles.length) {
      await ensureSupabaseMigrationsTable(client);
      for (const f of supabaseFiles) {
        const meta = parseSupabaseMigration(f);
        if (!meta) continue;

        const already = await supabaseMigrationIsApplied(client, meta.version);
        if (already) continue;

        const sql = fs.readFileSync(f.abs, 'utf8');
        if (!sql.trim()) {
          throw new Error(`Empty migration file: ${f.key}`);
        }

        await client.query('begin');
        try {
          await client.query(sql);
          await markSupabaseMigrationApplied(client, meta.version, meta.name, sql);
          await client.query('commit');
          console.log(`Applied: ${f.key}`);
        } catch (e) {
          await client.query('rollback');
          throw e;
        }
      }
    }

    console.log('Done.');
  });
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
