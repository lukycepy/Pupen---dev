export type PublicSiteMode = 'default' | 'maintenance' | 'onepage';

export interface OnepageConfig {
  badge_cs: string;
  badge_en: string;
  title_cs: string;
  title_en: string;
  intro_cs: string;
  intro_en: string;
  about_cs: string;
  about_en: string;
  membership_cs: string;
  membership_en: string;
  contacts_cs: string;
  contacts_en: string;
  status_cs: string;
  status_en: string;
  contact_email: string;
  instagram_url: string;
  facebook_url: string;
  primary_href: string;
  primary_label_cs: string;
  primary_label_en: string;
  secondary_href: string;
  secondary_label_cs: string;
  secondary_label_en: string;
}

function pickString(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

export function normalizePublicMode(value: unknown, fallbackMaintenanceEnabled = false): PublicSiteMode {
  if (value === 'maintenance' || value === 'onepage' || value === 'default') return value;
  return fallbackMaintenanceEnabled ? 'maintenance' : 'default';
}

export const DEFAULT_ONEPAGE_CONFIG: OnepageConfig = {
  badge_cs: 'Studentsky spolek',
  badge_en: 'Student association',
  title_cs: 'Vse dulezite o spolku Pupen na jedne strance',
  title_en: 'Everything important about Pupen on one page',
  intro_cs:
    'Hlavni web je docasne v omezenem rezimu. Tady najdete zakladni informace o spolku, clenstvi, kontakty a nejdulezitejsi odkazy.',
  intro_en:
    'The main website is temporarily in a limited mode. Here you can find the essential information about the association, membership, contacts and important links.',
  about_cs:
    '<p>Studentsky spolek Pupen, z.s. propojuje studenty, akce a komunitni zivot kolem FAPPZ a CZU. Venujeme se studentskym aktivitám, podpore komunity a smysluplnym projektum pro studenty.</p>',
  about_en:
    '<p>Studentsky spolek Pupen, z.s. connects students, events and community life around FAPPZ and CZU. We support student activities, community building and practical projects for students.</p>',
  membership_cs:
    '<p>Clenstvi je urcene predevsim pro studenty a absolventy spojene se spolkem. Soucasti je moznost zapojit se do aktivit spolku a mit prehled o novinkach a akcich.</p><p>Clensky prispevek je 200 Kc za semestr.</p>',
  membership_en:
    '<p>Membership is intended mainly for students and alumni connected with the association. It allows you to join our activities and stay informed about news and events.</p><p>The membership fee is CZK 200 per semester.</p>',
  contacts_cs:
    '<p>Pro bezne dotazy piste na <a href=\"mailto:info@pupen.org\">info@pupen.org</a>. Aktualni informace najdete take na nasich socialnich sitich.</p>',
  contacts_en:
    '<p>For general questions, contact us at <a href=\"mailto:info@pupen.org\">info@pupen.org</a>. You can also follow current updates on our social channels.</p>',
  status_cs:
    '<p>V tomto rezimu zobrazujeme jen to nejdulezitejsi. Ostatni casti webu mohou byt docasne omezeny nebo nedostupne.</p>',
  status_en:
    '<p>In this mode we only show the most important information. Other parts of the website may be temporarily limited or unavailable.</p>',
  contact_email: 'info@pupen.org',
  instagram_url: 'https://instagram.com/pupenfappz/',
  facebook_url: '',
  primary_href: '/cs/prihlaska',
  primary_label_cs: 'Clenska prihlaska',
  primary_label_en: 'Membership application',
  secondary_href: '/cs/kontakt',
  secondary_label_cs: 'Kontakt',
  secondary_label_en: 'Contact',
};

export function mergeOnepageConfig(value: unknown): OnepageConfig {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    badge_cs: pickString(record.badge_cs, DEFAULT_ONEPAGE_CONFIG.badge_cs),
    badge_en: pickString(record.badge_en, DEFAULT_ONEPAGE_CONFIG.badge_en),
    title_cs: pickString(record.title_cs, DEFAULT_ONEPAGE_CONFIG.title_cs),
    title_en: pickString(record.title_en, DEFAULT_ONEPAGE_CONFIG.title_en),
    intro_cs: pickString(record.intro_cs, DEFAULT_ONEPAGE_CONFIG.intro_cs),
    intro_en: pickString(record.intro_en, DEFAULT_ONEPAGE_CONFIG.intro_en),
    about_cs: pickString(record.about_cs, DEFAULT_ONEPAGE_CONFIG.about_cs),
    about_en: pickString(record.about_en, DEFAULT_ONEPAGE_CONFIG.about_en),
    membership_cs: pickString(record.membership_cs, DEFAULT_ONEPAGE_CONFIG.membership_cs),
    membership_en: pickString(record.membership_en, DEFAULT_ONEPAGE_CONFIG.membership_en),
    contacts_cs: pickString(record.contacts_cs, DEFAULT_ONEPAGE_CONFIG.contacts_cs),
    contacts_en: pickString(record.contacts_en, DEFAULT_ONEPAGE_CONFIG.contacts_en),
    status_cs: pickString(record.status_cs, DEFAULT_ONEPAGE_CONFIG.status_cs),
    status_en: pickString(record.status_en, DEFAULT_ONEPAGE_CONFIG.status_en),
    contact_email: pickString(record.contact_email, DEFAULT_ONEPAGE_CONFIG.contact_email),
    instagram_url: pickString(record.instagram_url, DEFAULT_ONEPAGE_CONFIG.instagram_url),
    facebook_url: pickString(record.facebook_url, DEFAULT_ONEPAGE_CONFIG.facebook_url),
    primary_href: pickString(record.primary_href, DEFAULT_ONEPAGE_CONFIG.primary_href),
    primary_label_cs: pickString(record.primary_label_cs, DEFAULT_ONEPAGE_CONFIG.primary_label_cs),
    primary_label_en: pickString(record.primary_label_en, DEFAULT_ONEPAGE_CONFIG.primary_label_en),
    secondary_href: pickString(record.secondary_href, DEFAULT_ONEPAGE_CONFIG.secondary_href),
    secondary_label_cs: pickString(record.secondary_label_cs, DEFAULT_ONEPAGE_CONFIG.secondary_label_cs),
    secondary_label_en: pickString(record.secondary_label_en, DEFAULT_ONEPAGE_CONFIG.secondary_label_en),
  };
}
