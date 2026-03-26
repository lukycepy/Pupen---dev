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
  const email = String(opts?.email || '').trim().toLowerCase();
  const issues: string[] = [];

  if (pw.length < 12) issues.push('min_length_12');
  if (pw.length > 128) issues.push('max_length_128');

  const lower = hasLower(pw);
  const upper = hasUpper(pw);
  const digit = hasDigit(pw);
  const symbol = hasSymbol(pw);
  const categories = [lower, upper, digit, symbol].filter(Boolean).length;
  if (!lower) issues.push('missing_lowercase');
  if (!upper) issues.push('missing_uppercase');
  if (!digit) issues.push('missing_digit');
  if (!symbol) issues.push('missing_symbol');

  if (email && pw.toLowerCase().includes(email)) issues.push('contains_email');
  const localPart = email.split('@')[0] || '';
  if (localPart && localPart.length >= 4 && pw.toLowerCase().includes(localPart)) issues.push('contains_email_localpart');

  const lowerPw = pw.toLowerCase();
  const common = ['password', 'heslo', 'qwerty', '123456', '111111', 'pupen'];
  if (common.some((x) => lowerPw.includes(x))) issues.push('common_password');

  let score = 0;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;
  if (categories >= 3) score += 1;
  if (categories === 4) score += 1;
  if (issues.includes('common_password')) score -= 2;
  if (issues.includes('contains_email') || issues.includes('contains_email_localpart')) score -= 1;
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

