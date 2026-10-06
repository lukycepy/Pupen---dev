import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { PROFILE_PERMISSION_KEYS_SET } from '@/lib/rbac/registry';

type JsonRecord = Record<string, unknown>;

interface AuthUserListRow {
  id?: string | null;
  email?: string | null;
}

interface UserUpsertInput extends JsonRecord {
  email?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  password?: unknown;
  send_password?: unknown;
}

interface PasswordErrorDetails {
  code: string | null;
  errno: string | null;
  syscall: string | null;
  address: string | null;
  port: string | null;
  command: string | null;
  responseCode: number | null;
}

interface UserUpsertResult {
  ok: boolean;
  email: string;
  id?: string;
  created?: boolean;
  passwordSent?: boolean;
  passwordError?: string | null;
  error?: string;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function getPasswordErrorDetails(error: unknown): PasswordErrorDetails {
  const err = toRecord(error);
  return {
    code: err.code ? String(err.code) : null,
    errno: err.errno ? String(err.errno) : null,
    syscall: err.syscall ? String(err.syscall) : null,
    address: err.address ? String(err.address) : null,
    port: err.port ? String(err.port) : null,
    command: err.command ? String(err.command) : null,
    responseCode: typeof err.responseCode === 'number' ? err.responseCode : null,
  };
}

function generatePassword(length = 14) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const b = 'abcdefghijkmnopqrstuvwxyz';
  const c = '23456789';
  const d = '!@#$%^&*';
  const all = a + b + c + d;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const out = [
    a[bytes[0] % a.length],
    b[bytes[1] % b.length],
    c[bytes[2] % c.length],
    d[bytes[3] % d.length],
  ];
  for (let i = out.length; i < length; i += 1) out.push(all[bytes[i] % all.length]);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = bytes[i] % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out.join('');
}

const ALLOWED_PROFILE_FIELDS = new Set([
  'first_name',
  'last_name',
  'email',
  'member_since',
  'member_expires_at',
  'member_expiry_notice_stage',
  'member_expiry_notice_at',
  'is_blocked',
  'blocked_at',
  'blocked_reason',
  ...PROFILE_PERMISSION_KEYS_SET,
]);

function pickProfilePatch(input: unknown) {
  const out: JsonRecord = {};
  const record = toRecord(input);
  for (const [k, v] of Object.entries(record)) {
    if (!ALLOWED_PROFILE_FIELDS.has(k)) continue;
    out[k] = v;
  }
  if ('is_admin' in out) out.is_admin = !!out.is_admin;
  if ('is_member' in out) out.is_member = !!out.is_member;
  if ('can_manage_admins' in out) out.can_manage_admins = !!out.can_manage_admins;
  if ('is_blocked' in out) out.is_blocked = !!out.is_blocked;
  for (const k of Object.keys(out)) {
    if (k.startsWith('can_view_') || k.startsWith('can_edit_')) out[k] = !!out[k];
  }
  if ('member_since' in out && !out.member_since) out.member_since = null;
  if ('member_expires_at' in out && !out.member_expires_at) out.member_expires_at = null;
  if ('member_expiry_notice_stage' in out && !out.member_expiry_notice_stage) out.member_expiry_notice_stage = null;
  if ('member_expiry_notice_at' in out && !out.member_expiry_notice_at) out.member_expiry_notice_at = null;
  if ('blocked_at' in out && !out.blocked_at) out.blocked_at = null;
  if ('blocked_reason' in out && !out.blocked_reason) out.blocked_reason = null;
  return out;
}

async function findUserIdByEmail(supabase: ReturnType<typeof getServerSupabase>, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users: AuthUserListRow[] = Array.isArray(res.data?.users) ? res.data.users : [];
    const u = users.find((x) => String(x.email || '').toLowerCase() === email.toLowerCase());
    if (u?.id) return String(u.id);
    if (users.length < perPage) return null;
  }
  return null;
}

async function sendPasswordEmail(email: string, password: string, firstName?: string) {
  const transporter = await getMailerWithSettings();
  const { subject, html } = await renderEmailTemplateWithDbOverride('admin_password', { email, password, firstName });
  const from = await getSenderFromSettings();
  await sendMailWithQueueFallback({
    transporter,
    meta: { kind: 'admin_password' },
    message: { from, to: email, subject, html },
  });
}

export async function POST(req: Request) {
  try {
    const { user: adminUser, profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const supabase = getServerSupabase();

    const body = toRecord(await req.json().catch(() => ({})));
    const usersInput = Array.isArray(body.users) ? body.users : null;

    async function upsertOne(input: unknown): Promise<UserUpsertResult> {
      const record = toRecord(input) as UserUpsertInput;
      const email = String(record.email || '').trim().toLowerCase();
      const first_name = String(record.first_name || '').trim();
      const last_name = String(record.last_name || '').trim();
      const providedPassword = typeof record.password === 'string' ? record.password : '';
      const shouldSend = record.send_password === true || (!providedPassword && record.send_password !== false);

      if (!email || !email.includes('@')) return { ok: false, email, error: 'Missing email' };

      let password = providedPassword || '';
      if (!password) {
        for (let i = 0; i < 20; i += 1) {
          const candidate = generatePassword(14);
          if (evaluatePassword(candidate, { email }).ok) {
            password = candidate;
            break;
          }
        }
        if (!password) password = generatePassword(18);
      }
      const pw = evaluatePassword(password, { email });
      if (!pw.ok) return { ok: false, email, error: 'Password does not meet policy' };

      let userId = await findUserIdByEmail(supabase, email);
      let created = false;

      const userMeta: JsonRecord = {};
      if (first_name) userMeta.first_name = first_name;
      if (last_name) userMeta.last_name = last_name;

      if (!userId) {
        const res = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: userMeta,
        });
        if (res.error) throw res.error;
        userId = res.data?.user?.id || null;
        created = true;
      } else {
        const upd = await supabase.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: userMeta,
        });
        if (upd.error) throw upd.error;
      }

      if (!userId) throw new Error('User not resolved');

      const profilePatch = pickProfilePatch({
        ...record,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
      });

      const { error: profErr } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
      if (profErr) throw profErr;

      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: adminUser.email || 'admin',
            admin_name: 'Uživatelé',
            action: created ? 'USER_CREATE' : 'USER_MERGE_UPDATE',
            target_id: userId,
            details: { email, is_admin: !!profilePatch.is_admin, is_member: !!profilePatch.is_member },
          },
        ]);
      } catch {}

      let passwordSent = false;
      let passwordError: string | null = null;
      if (shouldSend) {
        try {
          await sendPasswordEmail(email, password, first_name || undefined);
          passwordSent = true;
        } catch (error: unknown) {
          passwordSent = false;
          passwordError = getErrorMessage(error);
          const smtp = await getMailerDebugInfoWithSettings().catch(() => null);
          try {
            await supabase.from('admin_logs').insert([
              {
                admin_email: adminUser.email || 'admin',
                admin_name: 'Uživatelé',
                action: 'USER_PASSWORD_SEND_FAILED',
                target_id: userId,
                details: {
                  email,
                  error: passwordError,
                  smtp,
                  details: getPasswordErrorDetails(error),
                },
              },
            ]);
          } catch {}
        }
      }

      return { ok: true, id: userId, email, created, passwordSent, passwordError };
    }

    if (usersInput) {
      const results: UserUpsertResult[] = [];
      for (const u of usersInput.slice(0, 500)) {
        try {
          results.push(await upsertOne(u));
        } catch (error: unknown) {
          const email = String(toRecord(u).email || '').trim().toLowerCase();
          results.push({ ok: false, email, error: getErrorMessage(error) });
        }
      }
      return NextResponse.json({ ok: true, results });
    }

    const res = await upsertOne(body);
    if (!res.ok) return NextResponse.json({ error: res.error || 'Error' }, { status: 400 });
    return NextResponse.json(res);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
