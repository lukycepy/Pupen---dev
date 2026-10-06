export type PasswordPolicyResult =
  | { ok: true; score: number; issues: string[] }
  | { ok: false; score: number; issues: string[]; error: string };

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function hasLower(s: string) {
  return /[a-z]/.test(s);
}
function hasUpper(s: string) {
  return /[A-Z]/.test(s);
}
function hasDigit(s: string) {
  return /\d/.test(s);
}
function hasSymbol(s: string) {
  return /[^a-zA-Z0-9]/.test(s);
}

export function evaluatePassword(password: string, opts?: { email?: string | null }): PasswordPolicyResult {
  const pw = String(password || '');
  const issues: string[] = [];

  if (pw.length < 5) issues.push('min_length_5');
  if (pw.length > 128) issues.push('max_length_128');

  const email = String(opts?.email || '').trim().toLowerCase();
  if (email) {
    const local = email.split('@')[0] || '';
    if (local.length >= 3 && pw.toLowerCase().includes(local)) issues.push('contains_email');
  }

  const lower = hasLower(pw);
  const upper = hasUpper(pw);
  const digit = hasDigit(pw);
  const symbol = hasSymbol(pw);
  const categories = [lower, upper, digit, symbol].filter(Boolean).length;

  let score = 0;
  if (pw.length >= 5) score += 1;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (categories >= 3) score += 1;
  score = clamp(score, 0, 4);

  if (issues.length) {
    return { ok: false, score, issues, error: 'Password does not meet policy' };
  }
  return { ok: true, score, issues: [] };
}

export function passwordScoreLabel(score: number, lang: 'cs' | 'en' = 'cs') {
  const s = clamp(Number(score || 0), 0, 4);
  if (lang === 'en') {
    return s <= 1 ? 'Weak' : s === 2 ? 'Fair' : s === 3 ? 'Good' : 'Strong';
  }
  return s <= 1 ? 'Slabé' : s === 2 ? 'Průměrné' : s === 3 ? 'Dobré' : 'Silné';
}
