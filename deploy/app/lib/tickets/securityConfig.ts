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

function n(v: any, fallback: number) {
  const x = Number(v);
  if (!Number.isFinite(x)) return fallback;
  return x;
}

export function normalizeTicketSecurityConfig(input: any): TicketSecurityConfig {
  const cfg = input || {};
  return {
    rsvp: {
      windowMinutes: Math.max(1, Math.floor(n(cfg?.rsvp?.windowMinutes, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.windowMinutes))),
      maxAttemptsPerIp: Math.max(1, Math.floor(n(cfg?.rsvp?.maxAttemptsPerIp, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.maxAttemptsPerIp))),
      maxAttemptsPerEmail: Math.max(1, Math.floor(n(cfg?.rsvp?.maxAttemptsPerEmail, DEFAULT_TICKET_SECURITY_CONFIG.rsvp.maxAttemptsPerEmail))),
    },
    ui: {
      ipHighAttempts: Math.max(1, Math.floor(n(cfg?.ui?.ipHighAttempts, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipHighAttempts))),
      ipMedAttempts: Math.max(1, Math.floor(n(cfg?.ui?.ipMedAttempts, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipMedAttempts))),
      ipHighDistinctEmails: Math.max(1, Math.floor(n(cfg?.ui?.ipHighDistinctEmails, DEFAULT_TICKET_SECURITY_CONFIG.ui.ipHighDistinctEmails))),
      repeatOffenderHighScore: Math.max(1, Math.floor(n(cfg?.ui?.repeatOffenderHighScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderHighScore))),
      repeatOffenderMedScore: Math.max(1, Math.floor(n(cfg?.ui?.repeatOffenderMedScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderMedScore))),
      repeatOffenderMinScore: Math.max(1, Math.floor(n(cfg?.ui?.repeatOffenderMinScore, DEFAULT_TICKET_SECURITY_CONFIG.ui.repeatOffenderMinScore))),
    },
    domainSuggest: {
      minAttempts: Math.max(1, Math.floor(n(cfg?.domainSuggest?.minAttempts, DEFAULT_TICKET_SECURITY_CONFIG.domainSuggest.minAttempts))),
      minDistinctEmails: Math.max(1, Math.floor(n(cfg?.domainSuggest?.minDistinctEmails, DEFAULT_TICKET_SECURITY_CONFIG.domainSuggest.minDistinctEmails))),
    },
  };
}

