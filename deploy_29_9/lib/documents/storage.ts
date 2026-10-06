export function extractDocumentsPath(fileUrlOrPath: string) {
  const raw = String(fileUrlOrPath || '').trim();
  if (!raw) return null;

  if (!raw.includes('://') && raw.includes('/')) {
    if (raw.startsWith('documents/')) return raw.slice('documents/'.length);
    return raw;
  }

  const idx = raw.indexOf('/documents/');
  if (idx === -1) return null;
  const path = raw.slice(idx + '/documents/'.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

