'use client';

export const IMPERSONATION_STORAGE_KEY = 'pupen_impersonation_v1';

export interface ImpersonationState {
  originalEmail: string;
  targetEmail: string;
  targetUserId: string;
  restoreUrl: string;
  startedAt: string;
  destination: 'admin' | 'member';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function readImpersonationState(): ImpersonationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ImpersonationState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const originalEmail = normalizeEmail(parsed.originalEmail);
    const targetEmail = normalizeEmail(parsed.targetEmail);
    const targetUserId = String(parsed.targetUserId || '').trim();
    const restoreUrl = String(parsed.restoreUrl || '').trim();
    const startedAt = String(parsed.startedAt || '').trim();
    const destination = parsed.destination === 'admin' ? 'admin' : 'member';
    if (!originalEmail || !targetEmail || !targetUserId || !restoreUrl || !startedAt) return null;
    return { originalEmail, targetEmail, targetUserId, restoreUrl, startedAt, destination };
  } catch {
    return null;
  }
}

export function writeImpersonationState(state: ImpersonationState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    IMPERSONATION_STORAGE_KEY,
    JSON.stringify({
      originalEmail: normalizeEmail(state.originalEmail),
      targetEmail: normalizeEmail(state.targetEmail),
      targetUserId: String(state.targetUserId || '').trim(),
      restoreUrl: String(state.restoreUrl || '').trim(),
      startedAt: String(state.startedAt || '').trim(),
      destination: state.destination === 'admin' ? 'admin' : 'member',
    }),
  );
}

export function clearImpersonationState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
}

export function isImpersonatingAs(currentEmail: unknown, state: ImpersonationState | null) {
  if (!state) return false;
  const current = normalizeEmail(currentEmail);
  return !!current && current === state.targetEmail && current !== state.originalEmail;
}
