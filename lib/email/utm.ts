export function addUtmToEmailHtml(inputHtml: string, opts: { baseUrl: string; campaign: string; source?: string; medium?: string; email?: string }) {
  let html = String(inputHtml || '');
  const baseUrl = String(opts.baseUrl || '').trim() || 'https://pupen.org';
  const source = String(opts.source || 'newsletter');
  const medium = String(opts.medium || 'email');
  const campaign = String(opts.campaign || '').trim();
  const email = String(opts.email || '').trim();
  if (!campaign) return html;

  let baseHost = '';
  try {
    baseHost = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    baseHost = 'pupen.org';
  }

  return html.replace(/href=(["'])([^"']+)\1/gi, (m, q, hrefRaw) => {
    const href = String(hrefRaw || '');
    const lower = href.toLowerCase();
    if (!href || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('#') || lower.startsWith('javascript:')) return m;

    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return m;
    }

    const host = url.hostname.toLowerCase();
    const isRelative = !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);
    const isSameHost = host === baseHost || host.endsWith(`.${baseHost}`);

    const path = url.pathname || '';
    if (path.startsWith('/unsubscribe') || path.startsWith('/api/newsletter/unsubscribe')) return m;
    if (path.startsWith('/api/newsletter/track')) return m;

    if (isSameHost || isRelative) {
      if (!url.searchParams.has('utm_source') && !url.searchParams.has('utm_medium') && !url.searchParams.has('utm_campaign')) {
        url.searchParams.set('utm_source', source);
        url.searchParams.set('utm_medium', medium);
        url.searchParams.set('utm_campaign', campaign);
      }
    }

    // Wrap in click tracker
    const trackUrl = new URL('/api/newsletter/track', baseUrl);
    trackUrl.searchParams.set('n', campaign);
    if (email) trackUrl.searchParams.set('e', email);
    trackUrl.searchParams.set('url', url.toString());

    return `href=${q}${trackUrl.toString()}${q}`;
  });

  // Append open tracking pixel
  if (campaign && email) {
    const pixelUrl = new URL('/api/newsletter/track', baseUrl);
    pixelUrl.searchParams.set('n', campaign);
    pixelUrl.searchParams.set('e', email);
    pixelUrl.searchParams.set('open', '1');
    html = html.replace('</body>', `<img src="${pixelUrl.toString()}" width="1" height="1" alt="" style="display:none;" /></body>`);
  }

  return html;
}
