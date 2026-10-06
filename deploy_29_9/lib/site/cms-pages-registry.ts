export type CmsPageRegistryItem = {
  slug: string;
  label: string;
};

import { SITE_PAGES } from '@/lib/site/pages-registry';

const CMS_LABEL_OVERRIDES: Record<string, string> = {
  prihlaska: 'Přihláška',
  tos: 'Obchodní podmínky',
  cookies: 'Cookies',
  'ochrana-soukromi': 'Ochrana soukromí',
  support: 'Podpora',
  roadmap: 'Roadmap',
  'prvni-pomoc': 'První pomoc',
  bezpecnost: 'Bezpečnost',
  'vyrocni-zpravy': 'Výroční zprávy',
  changelog: 'Changelog',
};

const MEMBER_CMS_PAGES: CmsPageRegistryItem[] = [
  { slug: 'pravidla', label: 'Pravidla (člen)' },
  { slug: 'release_notes', label: 'Release notes (člen)' },
  { slug: 'adresar-clenu', label: 'Adresář členů (člen)' },
  { slug: 'ankety', label: 'Ankety (člen)' },
  { slug: 'projekty', label: 'Projekty (člen)' },
  { slug: 'governance', label: 'Governance (člen)' },
];

export const CMS_PAGES: CmsPageRegistryItem[] = [
  ...SITE_PAGES.map((p) => ({ slug: p.slug, label: CMS_LABEL_OVERRIDES[p.slug] || p.slug })),
  ...MEMBER_CMS_PAGES,
].filter((p, idx, arr) => arr.findIndex((x) => x.slug === p.slug) === idx);
