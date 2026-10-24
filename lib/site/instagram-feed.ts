export type InstagramFeedPost = {
  href: string;
  image_url: string;
  alt: string;
};

export type HomeInstagramConfig = {
  url: string;
  handle: string;
  posts: InstagramFeedPost[];
};

export const DEFAULT_HOME_INSTAGRAM_CONFIG: HomeInstagramConfig = {
  url: 'https://instagram.com/pupenfappz/',
  handle: '@pupenfappz',
  posts: [],
};

function cleanText(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function sanitizeInstagramFeedPost(value: unknown): InstagramFeedPost | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!record) return null;
  const href = cleanText(record.href, 1000);
  const imageUrl = cleanText(record.image_url, 2000);
  const alt = cleanText(record.alt, 160);
  if (!isHttpUrl(href) || !isHttpUrl(imageUrl)) return null;
  return {
    href,
    image_url: imageUrl,
    alt,
  };
}

export function mergeHomeInstagramConfig(value: unknown): HomeInstagramConfig {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const posts = Array.isArray(record.posts)
    ? record.posts.map((item) => sanitizeInstagramFeedPost(item)).filter((item): item is InstagramFeedPost => !!item).slice(0, 6)
    : [];

  return {
    url: cleanText(record.url, 1000) || DEFAULT_HOME_INSTAGRAM_CONFIG.url,
    handle: cleanText(record.handle, 120) || DEFAULT_HOME_INSTAGRAM_CONFIG.handle,
    posts,
  };
}
