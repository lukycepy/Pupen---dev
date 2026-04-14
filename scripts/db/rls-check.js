const { withClient, getDbUrl } = require('./utils');

async function main() {
  const url = getDbUrl();
  if (!url) {
    if (process.env.CI) {
      throw new Error('Missing DATABASE_URL (or DATABASE_URL_STAGING / DATABASE_URL_PROD with --env)');
    }
    console.log('SKIPPED: rls-check (no DATABASE_URL provided)');
    return;
  }
  await withClient(async (client) => {
    const tablesRes = await client.query(
      `
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname = 'public'
        and c.relname not in ('schema_migrations')
      order by c.relname asc
    `,
    );

    const policiesRes = await client.query(
      `
      select tablename as table_name, count(*)::int as policy_count
      from pg_policies
      where schemaname = 'public'
      group by tablename
    `,
    );

    const policyMap = new Map(policiesRes.rows.map((r) => [String(r.table_name), Number(r.policy_count)]));

    const noRls = [];
    const noPolicies = [];

    for (const t of tablesRes.rows) {
      const name = String(t.table_name);
      const rlsEnabled = !!t.rls_enabled;
      if (!rlsEnabled) {
        noRls.push(name);
        continue;
      }
      const count = policyMap.get(name) || 0;
      if (count <= 0) noPolicies.push(name);
    }

    if (noRls.length || noPolicies.length) {
      if (noRls.length) {
        console.error('Tables without RLS enabled:');
        for (const t of noRls) console.error(`- ${t}`);
      }
      if (noPolicies.length) {
        console.error('Tables with RLS but no policies:');
        for (const t of noPolicies) console.error(`- ${t}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`OK: ${tablesRes.rows.length} public tables have RLS + policies.`);
  });
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
