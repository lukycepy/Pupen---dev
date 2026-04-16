export type SitePageGroup = 'Navbar' | 'Nástroje' | 'Ostatní';

export type SitePageRegistryItem = {
  slug: string;
  group: SitePageGroup;
  labelKey?: string;
  toolKey?: string;
  defaults: { enabled: boolean; navbar?: boolean; tools?: boolean };
};

export const SITE_PAGES: SitePageRegistryItem[] = [
  { slug: 'akce', group: 'Navbar', labelKey: 'events', defaults: { enabled: true, navbar: true } },
  { slug: 'novinky', group: 'Navbar', labelKey: 'news', defaults: { enabled: true, navbar: true } },
  { slug: 'o-nas', group: 'Navbar', labelKey: 'about', defaults: { enabled: true, navbar: true } },
  { slug: 'kontakt', group: 'Navbar', labelKey: 'contact', defaults: { enabled: true, navbar: true } },

  { slug: 'prihlaska', group: 'Ostatní', defaults: { enabled: true } },
  { slug: 'tos', group: 'Ostatní', defaults: { enabled: true } },
  { slug: 'cookies', group: 'Ostatní', defaults: { enabled: true } },
  { slug: 'ochrana-soukromi', group: 'Ostatní', defaults: { enabled: true } },
  { slug: 'roman', group: 'Ostatní', defaults: { enabled: false } },

  { slug: 'sos', group: 'Nástroje', toolKey: 'sos', defaults: { enabled: true, tools: true } },
  { slug: 'schranka-duvery', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'ztraty-a-nalezy', group: 'Nástroje', toolKey: 'lostFound', defaults: { enabled: true, tools: true } },
  { slug: 'predmety', group: 'Nástroje', toolKey: 'subjects', defaults: { enabled: true, tools: true } },
  { slug: 'harmonogram', group: 'Nástroje', toolKey: 'schedule', defaults: { enabled: true, tools: true } },
  { slug: 'pruvodce', group: 'Nástroje', toolKey: 'guide', defaults: { enabled: true, tools: true } },
  { slug: 'partaci', group: 'Nástroje', toolKey: 'partners', defaults: { enabled: true, tools: true } },
  { slug: 'slevy', group: 'Nástroje', toolKey: 'discounts', defaults: { enabled: true, tools: true } },
  { slug: 'oteviraci-doba', group: 'Nástroje', toolKey: 'hours', defaults: { enabled: true, tools: true } },
  { slug: 'blog', group: 'Nástroje', toolKey: 'blog', defaults: { enabled: true, tools: true } },
  { slug: 'kvizy', group: 'Nástroje', toolKey: 'quizzes', defaults: { enabled: true, tools: true } },
  { slug: 'kariera', group: 'Nástroje', toolKey: 'jobs', defaults: { enabled: true, tools: true } },
  { slug: 'faq', group: 'Nástroje', toolKey: 'faq', defaults: { enabled: true, tools: true } },
  { slug: 'changelog', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'support', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'roadmap', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'prvni-pomoc', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'bezpecnost', group: 'Nástroje', defaults: { enabled: true, tools: true } },
  { slug: 'vybor', group: 'Ostatní', labelKey: 'board', defaults: { enabled: true } },
  { slug: 'vyrocni-zpravy', group: 'Nástroje', defaults: { enabled: true, tools: true } },
];

export function buildDefaultPagesConfig() {
  const out: Record<string, any> = {};
  for (const p of SITE_PAGES) out[p.slug] = { ...p.defaults };
  return out;
}
