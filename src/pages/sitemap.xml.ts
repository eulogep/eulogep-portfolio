import type { APIRoute } from 'astro';

import { hasApprovedCvAsset } from '../lib/cv-asset';
import { getProjectDetailProjects } from '../lib/page-models';
import { getSiteOrigin } from '../lib/site-config';

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export const GET: APIRoute = () => {
  const origin = getSiteOrigin() ?? 'http://localhost:4321';
  const routes = ['/', '/projects/', '/about/', ...getProjectDetailProjects().map((project) => `/projects/${project.slug}/`)];
  if (hasApprovedCvAsset()) routes.push('/cv/');

  const urls = routes
    .map((route) => `  <url><loc>${escapeXml(new URL(route, `${origin}/`).href)}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
