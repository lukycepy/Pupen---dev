export type TicketSecurityConfig = {
  rsvp: {
    windowMinutes: number;
    maxAttemptsPerIp: number;
    maxAttemptsPerEmail: number;
  };
  ui: {
    ipHighAttempts: number;
    ipMedAttempts: number;
    ipHighDistinctEmails: number;
    repeatOffenderHighScore: number;
    repeatOffenderMedScore: number;
    repeatOffenderMinScore: number;
  };
  domainSuggest: {
    minAttempts: number;
    minDistinctEmails: number;
  };
};

export const DEFAULT_TICKET_SECURITY_CONFIG: TicketSecurityConfig = {
  rsvp: {
    windowMinutes: 10,
    maxAttemptsPerIp: 12,
    maxAttemptsPerEmail: 8,
  },
  ui: {
    ipHighAttempts: 12,
    ipMedAttempts: 6,
    ipHighDistinctEmails: 6,
    repeatOffenderHighScore: 18,
    repeatOffenderMedScore: 10,
    repeatOffenderMinScore: 6,
  },
  domainSuggest: {
    minAttempts: 6,
    minDistinctEmails: 3,
  },
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function n(v: unknown, fallback: number) {
  const x = Number(v);
  if (!Number.isFinite(x)) return fallback;
  return x;
}

export function normalizeTicketSecurityConfig(input: unknown): TicketSecurityConfig {
  const cfg = toRecord(input);
  const rsvp = toRecord(cfg.rsvp);
  const ui = toRecord(cfg.ui);
  const domainSuggest = toRecord(cfg.domainSuggest);
  return {
    rsvp: {
      windowMinutes: Math.max(1, Math.floor(n(rsvp.windowMinutes, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.windowMinutes))),
      maxAttemptsPerIp: Math.max(1, Math.floor(n(rsvp.maxAttemptsPerIp, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.maxAttemptsPerIp))),
      maxAttemptsPerEmail: Math.max(1, Math.floor(n(rsvp.maxAttemptsPerEmail, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.maxAttemptsPerEmail))),
    },
    ui: {
      ipHighAttempts: Math.max(1, Math.floor(n(ui.ipHighAttempts, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipHighAttempts))),
      ipMedAttempts: Math.max(1, Math.floor(n(ui.ipMedAttempts, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipMedAttempts))),
      ipHighDistinctEmails: Math.max(1, Math.floor(n(ui.ipHighDistinctEmails, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipHighDistinctEmails))),
      repeatOffenderHighScore: Math.max(1, Math.floor(n(ui.repeatOffenderHighScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderHighScore))),
      repeatOffenderMedScore: Math.max(1, Math.floor(n(ui.repeatOffenderMedScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderMedScore))),
      repeatOffenderMinScore: Math.max(1, Math.floor(n(ui.repeatOffenderMinScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderMinScore))),
    },
    domainSuggest: {
      minAttempts: Math.max(1, Math.floor(n(domainSuggest.minAttempts, DEFAULT_TICKET_SECURITY_CONFIG.domainSuggest.minAttempts))),
      minDistinctEmails: Math.max(1, Math.floor(n(domainSuggest.minDistinctEmails, DEFAULT_TICKET_SECURITY_CONFIG.domainSuggest.minDistinctEmails))),
    },
  };
}
