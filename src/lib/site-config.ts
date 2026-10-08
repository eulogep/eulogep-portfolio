export function getSiteOrigin(value = import.meta.env.PUBLIC_SITE_ORIGIN): string | undefined {
  if (!value) return undefined;

  const candidate = new URL(value);
  if (candidate.protocol !== 'https:') throw new Error('PUBLIC_SITE_ORIGIN must use HTTPS.');
  return candidate.origin;
}

export function toCanonicalUrl(pathname: string, origin = getSiteOrigin()): string | undefined {
  return origin ? new URL(pathname, `${origin}/`).href : undefined;
}
