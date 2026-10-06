import sanitizeHtml from 'sanitize-html';
import { decodeHtmlEntitiesDeep, escapeHtml, looksLikeHtml } from './richtext-shared';

const allowedTags = [
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
];

export function richTextToSafeHtml(input: string) {
  const decoded = decodeHtmlEntitiesDeep(String(input ?? ''));
  if (!decoded.trim()) return '';

  if (looksLikeHtml(decoded)) {
    return sanitizeHtml(decoded, {
      allowedTags,
      allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class'] },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      allowProtocolRelative: false,
      transformTags: {
        a: (tagName, attribs) => {
          const href = String(attribs.href || '');
          const safeHref = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') ? href : '';
          return {
            tagName,
            attribs: {
              href: safeHref,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          };
        },
      },
    });
  }

  return escapeHtml(decoded).replace(/\n/g, '<br/>');
}

