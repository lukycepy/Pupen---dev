import { decodeHtmlEntitiesDeep, escapeHtml, looksLikeHtml } from './richtext-shared';

export function richTextToClientHtml(input: string) {
  const decoded = decodeHtmlEntitiesDeep(String(input ?? ''));
  if (!decoded.trim()) return '';
  if (looksLikeHtml(decoded)) return decoded;
  return escapeHtml(decoded).replace(/\n/g, '<br/>');
}

