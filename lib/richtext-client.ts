import { decodeHtmlEntitiesDeep, escapeHtml, looksLikeHtml } from './richtext-shared';

export function richTextToClientHtml(input: string) {
  const decoded = decodeHtmlEntitiesDeep(String(input ?? ''));
  if (!decoded.trim()) return '';
  const sanitized = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  if (looksLikeHtml(sanitized)) return sanitized;
  return escapeHtml(decoded).replace(/\n/g, '<br/>');
}
