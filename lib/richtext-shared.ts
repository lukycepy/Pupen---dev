export function decodeHtmlEntitiesDeep(input: string, maxPasses = 3) {
  let s = String(input ?? '');
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next = decodeHtmlEntitiesOnce(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

function decodeHtmlEntitiesOnce(input: string) {
  const s = String(input ?? '');
  return s
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (_m, code) => {
      const c = String(code);
      if (c[0] === '#') {
        const isHex = c[1]?.toLowerCase() === 'x';
        const num = Number.parseInt(isHex ? c.slice(2) : c.slice(1), isHex ? 16 : 10);
        if (!Number.isFinite(num)) return _m;
        try {
          return String.fromCodePoint(num);
        } catch {
          return _m;
        }
      }
      switch (c) {
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'amp':
          return '&';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        case 'nbsp':
          return ' ';
        default:
          return _m;
      }
    });
}

export function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(String(s ?? ''));
}

export function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtmlToText(s: string) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

