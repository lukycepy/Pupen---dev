import fs from 'node:fs';
import path from 'node:path';

/**
 * Předprodukční kontrola env proměnných (release checklist, sekce 2–4).
 *
 * Read-only nástroj: nic nezapisuje ani se nepřipojuje do databáze, jen
 * ověří, že prostředí má vše potřebné před nasazením. Povinné proměnné
 * chybí => nenulový exit kód (vhodné pro CI i pro ruční kontrolu na VPS).
 *
 * Použití:
 *   node "Ostatní/scripts/ops/check-env.mjs"            # .env + .env.local
 *   node "Ostatní/scripts/ops/check-env.mjs" --env prod # + .env.production(.local)
 */

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

function loadEnvFiles() {
  const env = getEnvFromArgs();
  const files = ['.env', '.env.local'];
  if (env === 'prod') files.push('.env.production', '.env.production.local');
  if (env === 'staging') files.push('.env.staging', '.env.staging.local');
  for (const f of files) {
    const parsed = parseDotEnvFile(path.join(process.cwd(), f));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] == null) process.env[k] = String(v);
    }
  }
  return files;
}

// Povinné – bez nich aplikace nefunguje (checklist sekce 2).
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'DATABASE_URL',
];

// Doporučené – degradovaný režim / chybějící funkce (checklist sekce 3–4).
const recommended = [
  'CRON_SECRET',
  'SITE_CONFIG_ID',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'PUPEN_FIO_WEBHOOK_SECRET',
  'BOUNCE_WEBHOOK_SECRET',
  'EMAIL_FROM',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_DSN',
];

// Volitelné (jen informativně) – telemetrie / image hosty.
const optional = [
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
  'CSP_ENFORCE',
  'NEXT_IMAGE_REMOTE_HOSTS',
];

const isSet = (key) => {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0;
};

// Proměnné, které dodává runtime/CI – do `.env.example` nepatří.
const runtimeProvided = new Set(['NODE_ENV', 'CI', 'NEXT_RUNTIME', 'PLAYWRIGHT_BROWSERS_PATH']);

const sourceRoots = ['app', 'lib', 'components', 'Ostatní/scripts'];
const sourceFiles = [
  'proxy.ts',
  'middleware.ts',
  'instrumentation.ts',
  'instrumentation-client.ts',
  'next.config.mjs',
  // Sentry konfigurace se načítá mimo `app/` – bez nich by drift check
  // nezachytil `SENTRY_DSN`, `SENTRY_ENVIRONMENT` ani `SENTRY_RELEASE`.
  'sentry.server.config.ts',
  'sentry.edge.config.ts',
];
const skipDirs = new Set(['node_modules', '.next', '.git', 'coverage', 'test-results', 'playwright-report']);

// Precondition checklistu: každá `process.env.*` v kódu musí být v `.env.example`.
function collectUsedEnvNames() {
  const found = new Set();
  const scan = (dir) => {
    const abs = path.join(process.cwd(), dir);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) scan(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) continue;
      const content = fs.readFileSync(path.join(abs, entry.name), 'utf8');
      for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
        found.add(m[1]);
      }
    }
  };
  for (const root of sourceRoots) scan(root);
  for (const file of sourceFiles) {
    const abs = path.join(process.cwd(), file);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) found.add(m[1]);
  }
  return found;
}

function collectExampleKeys() {
  const parsed = parseDotEnvFile(path.join(process.cwd(), '.env.example'));
  return new Set(Object.keys(parsed));
}

const usedNames = collectUsedEnvNames();
const exampleKeys = collectExampleKeys();
const exampleDrift = [...usedNames]
  .filter((k) => !exampleKeys.has(k) && !runtimeProvided.has(k))
  .sort();

const files = loadEnvFiles();

const missingRequired = required.filter((k) => !isSet(k));
const missingRecommended = recommended.filter((k) => !isSet(k));
const missingOptional = optional.filter((k) => !isSet(k));

// Dodatečné invarianty z provozních zkušeností (viz projektová pravidla).
const issues = [];

const dbUrl = process.env.DATABASE_URL || '';
if (isSet('DATABASE_URL') && !/[?&]sslmode=require/.test(dbUrl)) {
  issues.push('DATABASE_URL neobsahuje `?sslmode=require` (nutné pro Supabase SSL).');
}
if (isSet('DATABASE_URL') && /pooler\.supabase\.com/.test(dbUrl) && !/uselibpqcompat=true/.test(dbUrl)) {
  issues.push(
    'DATABASE_URL míří na Supabase pooler bez `uselibpqcompat=true` (Node může odmítnout certifikát).',
  );
}
if (isSet('ENABLE_EMAIL_TESTS') && String(process.env.ENABLE_EMAIL_TESTS) === 'true' && process.env.NODE_ENV === 'production') {
  issues.push('ENABLE_EMAIL_TESTS=true je v produkci zakázané (odhalený testovací endpoint).');
}

const ok = missingRequired.length === 0 && issues.length === 0;

const report = {
  ok,
  env: getEnvFromArgs() || 'default',
  files,
  required: { ok: missingRequired.length === 0, missing: missingRequired },
  recommended: { ok: missingRecommended.length === 0, missing: missingRecommended },
  optional: { missing: missingOptional },
  exampleDrift: { missing: exampleDrift },
  issues,
};

console.log(JSON.stringify(report, null, 2));

if (!ok) {
  if (missingRequired.length) {
    console.error(`\nChybí povinné proměnné: ${missingRequired.join(', ')}`);
  }
  if (issues.length) {
    console.error('\nProblémy s konfigurací:');
    for (const i of issues) console.error(`- ${i}`);
  }
  process.exit(1);
}

if (missingRecommended.length) {
  console.warn(`\nUpozornění: chybí doporučené proměnné: ${missingRecommended.join(', ')}`);
}

if (exampleDrift.length) {
  console.warn(
    `\nUpozornění: tyto proměnné z kódu chybí v .env.example: ${exampleDrift.join(', ')}`
  );
}

console.log('\nOK: povinné env proměnné jsou nastavené.');
