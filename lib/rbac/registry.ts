export const RBAC_MODULE_IDS = [
  'events',
  'news',
  'messages',
  'partners',
  'banners',
  'faq',
  'feedback',
  'apps',
  'budget',
  'assets',
  'documents',
  'guide',
  'hunts',
  'map',
  'meetings',
  'governance',
  'polls',
  'quizzes',
  'jobs',
  'schedule',
  'hours',
  'discounts',
  'qr',
  'archive',
  'gallery',
  'logs',
  'analytics',
  'projects',
  'moderation',
  'refunds',
  'ticket_security',
  'blog_mod',
  'og_preview',
  'member_portal',
  'reviews',
  'books',
  'newsletter',
  'email_settings',
] as const;

export type RbacModuleId = (typeof RBAC_MODULE_IDS)[number];

export const PROFILE_BASE_PERMISSION_KEYS = ['is_admin', 'is_member', 'can_manage_admins'] as const;

export function viewKey(moduleId: RbacModuleId) {
  return `can_view_${moduleId}` as const;
}

export function editKey(moduleId: RbacModuleId) {
  return `can_edit_${moduleId}` as const;
}

export function getProfilePermissionKeys() {
  const keys: string[] = [...PROFILE_BASE_PERMISSION_KEYS];
  for (const m of RBAC_MODULE_IDS) {
    keys.push(`can_view_${m}`);
    keys.push(`can_edit_${m}`);
  }
  return keys;
}

export const PROFILE_PERMISSION_KEYS_SET = new Set(getProfilePermissionKeys());
