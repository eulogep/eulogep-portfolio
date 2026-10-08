import type { APIRoute } from 'astro';

import { getSiteOrigin } from '../lib/site-config';

export const GET: APIRoute = () => {
  const origin = getSiteOrigin();
  const body = origin
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
