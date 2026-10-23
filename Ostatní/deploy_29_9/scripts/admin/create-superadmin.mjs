import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function parseDotEnv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/g)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnvFromFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const vars = parseDotEnv(text);
    for (const [k, v] of Object.entries(vars)) {
      if (process.env[k] == null || process.env[k] === '') process.env[k] = String(v);
    }
  } catch {}
}

const root = process.cwd();
loadEnvFromFile(path.join(root, '.env'));
loadEnvFromFile(path.join(root, '.env.local'));

const args = process.argv.slice(2);
const emailArgIdx = args.findIndex((a) => a === '--email');
const email = emailArgIdx >= 0 ? String(args[emailArgIdx + 1] || '').trim() : '';
if (!email) {
  console.error('Missing --email');
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing env NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const permissions = {
  is_admin: true,
  is_member: true,
  can_manage_admins: true,
  can_view_events: true,
  can_edit_events: true,
  can_view_news: true,
  can_edit_news: true,
  can_view_faq: true,
  can_edit_faq: true,
  can_view_partners: true,
  can_edit_partners: true,
  can_view_apps: true,
  can_edit_apps: true,
  can_view_documents: true,
  can_edit_documents: true,
  can_view_gallery: true,
  can_edit_gallery: true,
  can_view_map: true,
  can_edit_map: true,
  can_view_hunts: true,
  can_edit_hunts: true,
  can_view_budget: true,
  can_edit_budget: true,
  can_view_logs: true,
  can_edit_logs: true,
  can_view_messages: true,
  can_edit_messages: true,
  can_view_meetings: true,
  can_edit_meetings: true,
  can_view_polls: true,
  can_edit_polls: true,
  can_view_quizzes: true,
  can_edit_quizzes: true,
  can_view_jobs: true,
  can_edit_jobs: true,
  can_view_schedule: true,
  can_edit_schedule: true,
  can_view_guide: true,
  can_edit_guide: true,
  can_view_hours: true,
  can_edit_hours: true,
  can_view_discounts: true,
  can_edit_discounts: true,
  can_view_feedback: true,
  can_edit_feedback: true,
  can_view_qr: true,
  can_edit_qr: true,
  can_view_assets: true,
  can_edit_assets: true,
  can_view_archive: true,
  can_edit_archive: true,
  can_view_books: true,
  can_edit_books: true,
  can_view_blog_mod: true,
  can_edit_blog_mod: true,
  can_view_reviews: true,
  can_edit_reviews: true,
};

async function findUserIdByEmail(targetEmail) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const user = (res.data?.users || []).find((u) => String(u.email || '').toLowerCase() === targetEmail.toLowerCase());
    if (user?.id) return user.id;
    if (!res.data?.users?.length || res.data.users.length < perPage) return null;
  }
  return null;
}

async function ensureSuperadminProfile(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      email,
      ...permissions,
    })
    .eq('id', userId);
  if (error) throw error;
}

async function main() {
  let userId = await findUserIdByEmail(email);

  if (!userId) {
    const invite = await supabase.auth.admin.inviteUserByEmail(email);
    if (invite.error) throw invite.error;
    userId = invite.data?.user?.id || null;
  }

  if (!userId) {
    console.error('Could not resolve user id');
    process.exit(1);
  }

  await ensureSuperadminProfile(userId);
  console.log(JSON.stringify({ ok: true, email }, null, 2));
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});

