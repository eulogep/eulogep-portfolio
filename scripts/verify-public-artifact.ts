import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertPublicSafety } from './compile-public-portfolio';
import { hasApprovedCvAsset } from '../src/lib/cv-asset';
import { getProjectDetailProjects } from '../src/lib/page-models';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(workspaceRoot, 'dist');
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.xml', '.txt', '.svg', '.map']);

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(target) : [target];
      }),
    )
  ).flat();
}

async function privateRepositoryNames(): Promise<string[]> {
  const inventoryPath = path.join(workspaceRoot, 'identity-sources/github/processed/repository-inventory.json');
  const source = await readFile(inventoryPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (!source) return [];
  const inventory = JSON.parse(source) as { repositories: Array<{ repository_name: string; visibility: string }> };
  return inventory.repositories.filter((repository) => repository.visibility === 'PRIVATE').map((repository) => repository.repository_name);
}

function routeFile(pathname: string): string {
  if (pathname === '/') return path.join(distRoot, 'index.html');
  if (pathname.endsWith('/')) return path.join(distRoot, pathname.slice(1), 'index.html');
  return path.join(distRoot, pathname.slice(1));
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

const files = await filesBelow(distRoot);
const relativeFiles = new Set(files.map((file) => path.relative(distRoot, file)));
const requiredBrandAssets = [
  'favicon.ico',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest',
  'brand/em-mark-72.png',
  'brand/em-mark-144.png',
  'brand/og-default-v2.jpg',
  'gallery/journey-map-1600.webp',
  'gallery/journey-map-960.avif',
  'gallery/manga-wave-mark.svg',
  'media/manga-wave-presentation-poster.webp',
  'institutions/academie-paris.png',
  'institutions/lycee-paul-eluard.png',
  'institutions/esiea.png',
  'institutions/cy-tech.png',
  'institutions/formasup-paris-idf.svg',
  'institutions/soufflet-malt.png',
  'profile/euloge-mabiala-portrait-960.webp',
  'profile/euloge-mabiala-portrait-640.avif',
];
for (const asset of requiredBrandAssets) {
  if (!relativeFiles.has(asset)) throw new Error(`Required brand asset is missing: ${asset}`);
}
const clientScripts = files.filter((file) => ['.js', '.mjs'].includes(path.extname(file)));
const languageScript = clientScripts.find((file) => path.basename(file).startsWith('LanguageSwitcher.'));
const carouselScript = clientScripts.find((file) => path.basename(file).startsWith('GlassCarousel3D.'));
if (clientScripts.length !== 2 || !languageScript || !carouselScript) {
  throw new Error('Only the shared language switcher and GlassCarousel3D client modules are permitted.');
}
if (Buffer.byteLength(await readFile(carouselScript, 'utf8')) > 16000) throw new Error('Carousel script exceeds its 16 KB budget.');
if (Buffer.byteLength(await readFile(languageScript, 'utf8')) > 48000) throw new Error('Language switcher script exceeds its 48 KB budget.');
const forbiddenFile = files.find((file) =>
  /professional-identity|identity-sources|repository-inventory|evidence-registry/i.test(path.relative(distRoot, file)),
);
if (forbiddenFile) throw new Error('Private identity file name found in the public artifact.');

const privateNames = await privateRepositoryNames();
for (const file of files.filter((candidate) => textExtensions.has(path.extname(candidate)))) {
  assertPublicSafety(await readFile(file, 'utf8'), privateNames);
}

const projectRoutes = getProjectDetailProjects().map((project) => `/projects/${project.slug}/`);
const requiredRoutes = ['/', '/parcours/', '/projects/', '/about/', '/cv/', ...projectRoutes];
const requiredFiles = [...requiredRoutes.map(routeFile), path.join(distRoot, '404.html'), path.join(distRoot, 'robots.txt'), path.join(distRoot, 'sitemap.xml')];
for (const requiredFile of requiredFiles) {
  if (!relativeFiles.has(path.relative(distRoot, requiredFile))) {
    throw new Error(`Required public route artifact is missing: ${path.relative(distRoot, requiredFile)}`);
  }
}

const htmlFiles = files.filter((file) => path.extname(file) === '.html');
const titles = new Set<string>();
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  for (const required of ['href="#contenu"', '<main', '<header', '<footer', '<html lang="fr"', '<meta name="description"', 'property="og:title"']) {
    if (!html.includes(required)) throw new Error(`${path.relative(distRoot, htmlFile)} shell assertion failed: ${required}`);
  }
  for (const required of ['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest', 'footer-brand__mark']) {
    if (!html.includes(required)) throw new Error(`${path.relative(distRoot, htmlFile)} brand integration assertion failed: ${required}`);
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)];
  const carouselRoute = ['index.html', 'projects/index.html'].includes(path.relative(distRoot, htmlFile));
  if (scripts.length !== (carouselRoute ? 2 : 1)) throw new Error(`Unexpected script count: ${htmlFile}`);
  const allowedModules = carouselRoute ? ['LanguageSwitcher', 'GlassCarousel3D'] : ['LanguageSwitcher'];
  for (const [script] of scripts) {
    if (!allowedModules.some((name) => new RegExp(`^<script type="module" src="\\/_astro\\/${name}\\.[^"/]+\\.js"><\\/script>$`).test(script))) {
      throw new Error('Only the approved external same-origin modules are permitted; no inline scripts.');
    }
  }
  if (countMatches(html, /data-language-select/g) !== 1 || !html.includes('<option value="fr">FR</option>') || !html.includes('<option value="en">EN</option>')) {
    throw new Error(`${path.relative(distRoot, htmlFile)} must expose one French/English language selector.`);
  }
  if (countMatches(html, /<h1(?:\s|>)/g) !== 1) throw new Error(`${path.relative(distRoot, htmlFile)} must contain exactly one h1.`);

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  if (!title || titles.has(title)) throw new Error(`Missing or duplicate title in ${path.relative(distRoot, htmlFile)}.`);
  titles.add(title);

  for (const href of html.matchAll(/href="([^"]+)"/g)) {
    const target = href[1];
    if (target.startsWith('#') || /^[a-z]+:/i.test(target)) continue;
    const url = new URL(target, 'https://portfolio.invalid');
    const targetFile = routeFile(url.pathname);
    if (!relativeFiles.has(path.relative(distRoot, targetFile))) {
      throw new Error(`Broken internal link in ${path.relative(distRoot, htmlFile)}: ${target}`);
    }
  }
}

const homeHtml = await readFile(path.join(distRoot, 'index.html'), 'utf8');
if (!homeHtml.includes('data-home-primary-project-count="3"')) throw new Error('Home must identify exactly three primary projects.');
if (countMatches(homeHtml, /data-project-id="project-/g) !== 7) throw new Error('Home must render all seven featured projects exactly once.');
for (const required of ['/profile/euloge-mabiala-portrait-640.avif', '/profile/euloge-mabiala-portrait-960.webp', 'alt="Portrait d’Euloge Mabiala"']) {
  if (!homeHtml.includes(required)) throw new Error(`Home portrait integration is missing: ${required}`);
}

const journeyHtml = await readFile(path.join(distRoot, 'parcours/index.html'), 'utf8');
if (countMatches(journeyHtml, /class="journey-chapter journey-chapter--/g) !== 6) throw new Error('Journey must render six narrative chapters.');
for (const required of ['Archive personnelle · à confirmer', 'Dépôts publics inspectés', 'Périmètre professionnel vérifié', 'Galerie de construction']) {
  if (!journeyHtml.includes(required)) throw new Error(`Journey evidence boundary is missing: ${required}`);
}
for (const required of [
  '/institutions/academie-paris.png',
  '/institutions/lycee-paul-eluard.png',
  '/institutions/esiea.png',
  '/institutions/cy-tech.png',
  '/institutions/formasup-paris-idf.svg',
  '/institutions/soufflet-malt.png',
  'leur présence ne suggère ni partenariat, ni validation de ce portfolio',
]) {
  if (!journeyHtml.includes(required)) throw new Error(`Journey institution identity is missing: ${required}`);
}
if (countMatches(journeyHtml, /<a class="institution-mark(?: institution-mark--(?:dark|wide))?"/g) !== 6) {
  throw new Error('Journey must render exactly six institution marks.');
}

const aboutHtml = await readFile(path.join(distRoot, 'about/index.html'), 'utf8');
if (countMatches(aboutHtml, /class="certification-card"/g) !== 3) {
  throw new Error('About must render exactly three corroborated certification cards.');
}
for (const required of [
  'CCNA Switching, Routing and Wireless Essentials',
  'Astronomer Certification for Apache Airflow 3 Fundamentals',
  'UNODC cybercrime e-learning training',
  'Badge ou certificat direct encore à archiver',
]) {
  if (!aboutHtml.includes(required)) throw new Error(`About certification evidence boundary is missing: ${required}`);
}
if (/NASA Open Science|HackerRank|Proofpoint|Cybersecurity Passport/.test(aboutHtml)) {
  throw new Error('About exposes a conflicting or unverified certification.');
}

const projectsHtml = await readFile(path.join(distRoot, 'projects/index.html'), 'utf8');
if (countMatches(projectsHtml, /data-project-id="project-/g) !== 12) throw new Error('Projects index must render seven featured and five secondary projects.');
if (!projectsHtml.includes('Douze projets publics') || !projectsHtml.includes('Featured · secondaires')) {
  throw new Error('Projects showcase must identify its complete featured and secondary inventory.');
}

const mangaHtml = await readFile(path.join(distRoot, 'projects/manga-wave/index.html'), 'utf8');
if (!mangaHtml.includes('Implémentation personnelle et composants tiers')) throw new Error('Manga Wave attribution boundary is missing.');
for (const required of [
  '<video controls playsinline preload="metadata"',
  'poster="/media/manga-wave-presentation-poster.webp"',
  'https://manga-wave-bienvenue-fusion.vercel.app/media/manga-wave-presentation-16x9.mp4',
  'sans constituer une preuve technique indépendante',
  'appartiennent à leurs ayants droit',
]) {
  if (!mangaHtml.includes(required)) throw new Error(`Manga Wave presentation boundary is missing: ${required}`);
}
if (countMatches(mangaHtml, /<video(?:\s|>)/g) !== 1 || /<video[^>]*\bautoplay\b/i.test(mangaHtml)) {
  throw new Error('Manga Wave must render exactly one manually controlled presentation video.');
}
const ecvHtml = await readFile(path.join(distRoot, 'projects/ecv/index.html'), 'utf8');
if (!ecvHtml.includes('Portée de la preuve sécurité')) throw new Error('ECV security limitation is missing.');

const architectureExpectations: Record<string, { nodes: string[]; heading: string }> = {
  'engineer-learning-os': { heading: 'Architecture d’Engineer Learning OS', nodes: ['Routage', 'PDF.js', 'Docling', 'Cache fichier local', 'EvidenceRecord', 'Révision espacée'] },
  'professional-hub': { heading: 'Architecture de Professional Hub', nodes: ['Proxy et garde', 'Supabase Postgres', 'Cloudflare R2', 'Finalisation'] },
  'corrector-ai': { heading: 'Architecture de Corrector AI', nodes: ['OCR multimodal', 'Contrôle du barème', 'Claude', 'DeepSeek', 'Gemini', 'Relecture professeur'] },
};
for (const [slug, expected] of Object.entries(architectureExpectations)) {
  const html = await readFile(path.join(distRoot, `projects/${slug}/index.html`), 'utf8');
  const label = `projects/${slug}`;
  if (countMatches(html, /<svg[^>]*class="arch-svg"/g) !== 1) throw new Error(`${label} must contain exactly one architecture SVG.`);
  for (const required of ['role="img"', 'aria-labelledby="arch-project-', '<desc id="arch-project-', 'aria-labelledby="architecture-title"', 'arch-stages', 'arch-textalt', 'arch-evidence', expected.heading]) {
    if (!html.includes(required)) throw new Error(`${label} architecture accessibility/structure assertion failed: ${required}`);
  }
  for (const node of expected.nodes) {
    if (countMatches(html, new RegExp(`class="arch-node__title"[^>]*>${node}<`, 'g')) !== 1) throw new Error(`${label} architecture node missing or duplicated: ${node}`);
  }
  if (/ style="|<style|<script/.test(html.slice(html.indexOf('arch-figure')))) throw new Error(`${label} architecture must ship no inline style or script (CSP).`);
  if (/\bev-[a-z0-9-]+\b/.test(html)) throw new Error(`${label} exposes a raw evidence identifier.`);
}
const evidenceProjects = ['engineer-learning-os', 'professional-hub', 'corrector-ai'];
const evidenceFilesSeen = new Set<string>();
for (const slug of evidenceProjects) {
  const html = await readFile(path.join(distRoot, `projects/${slug}/index.html`), 'utf8');
  const label = `projects/${slug}`;
  if (!html.includes('aria-labelledby="execution-evidence-title"')) throw new Error(`${label} must render its execution evidence section.`);
  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = image[0];
    if (!/data-evidence|\/evidence\//.test(tag)) continue;
    for (const attribute of ['width="', 'height="', 'alt="', 'loading="lazy"', 'decoding="async"']) {
      if (!tag.includes(attribute)) throw new Error(`${label} evidence image is missing ${attribute}: ${tag.slice(0, 120)}`);
    }
    if (/alt=""/.test(tag)) throw new Error(`${label} evidence image has an empty alt text.`);
  }
  for (const reference of html.matchAll(/\/evidence\/[a-z0-9/_.-]+\.(?:avif|webp)/g)) {
    if (!relativeFiles.has(reference[0].slice(1))) throw new Error(`${label} references a missing evidence asset: ${reference[0]}`);
    evidenceFilesSeen.add(reference[0].slice(1));
  }
  if (/\/Users\/|\/private\/|127\.0\.0\.1|sb_publishable|sb_secret/.test(html)) throw new Error(`${label} exposes a local path, address or credential shape.`);
}
if (evidenceFilesSeen.size === 0) throw new Error('No evidence assets are referenced by the case studies.');
const { default: sharp } = await import('sharp');
const brandDimensions = new Map<string, readonly [number, number]>([
  ['favicon-16x16.png', [16, 16]],
  ['favicon-32x32.png', [32, 32]],
  ['apple-touch-icon.png', [180, 180]],
  ['android-chrome-192x192.png', [192, 192]],
  ['android-chrome-512x512.png', [512, 512]],
  ['brand/em-mark-72.png', [72, 72]],
  ['brand/em-mark-144.png', [144, 144]],
  ['brand/og-default-v2.jpg', [1200, 630]],
  ['gallery/journey-map-1600.webp', [1600, 900]],
  ['gallery/journey-map-960.avif', [960, 540]],
  ['media/manga-wave-presentation-poster.webp', [1280, 720]],
  ['institutions/academie-paris.png', [480, 480]],
  ['institutions/lycee-paul-eluard.png', [270, 100]],
  ['institutions/esiea.png', [416, 144]],
  ['institutions/cy-tech.png', [150, 79]],
  ['institutions/soufflet-malt.png', [604, 99]],
  ['profile/euloge-mabiala-portrait-960.webp', [960, 960]],
  ['profile/euloge-mabiala-portrait-640.avif', [640, 640]],
]);
for (const [asset, [expectedWidth, expectedHeight]] of brandDimensions) {
  const metadata = await sharp(path.join(distRoot, asset)).metadata();
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(`${asset} has invalid dimensions: ${metadata.width}x${metadata.height}.`);
  }
  if (metadata.exif || metadata.xmp) throw new Error(`${asset} carries embedded capture metadata.`);
}
for (const evidenceFile of evidenceFilesSeen) {
  const meta = await sharp(path.join(distRoot, evidenceFile)).metadata();
  if (meta.exif || meta.xmp) throw new Error(`Evidence asset carries capture metadata: ${evidenceFile}`);
}

const withoutDiagram = await readFile(path.join(distRoot, 'projects/ecv/index.html'), 'utf8');
if (withoutDiagram.includes('arch-figure')) throw new Error('A project without architecture evidence must not render a diagram.');

const cvHtml = await readFile(path.join(distRoot, 'cv/index.html'), 'utf8');
if (hasApprovedCvAsset()) {
  if (!cvHtml.includes('data-cv-status="available"') || !cvHtml.includes('download=')) throw new Error('Approved CV download is missing.');
} else if (!cvHtml.includes('data-cv-status="fallback"') || cvHtml.includes('CV_Euloge_MABIALA')) {
  throw new Error('Safe missing-CV fallback is not active.');
}

const robots = await readFile(path.join(distRoot, 'robots.txt'), 'utf8');
const sitemap = await readFile(path.join(distRoot, 'sitemap.xml'), 'utf8');
if (process.env.PUBLIC_SITE_ORIGIN) {
  if (!robots.includes('Allow: /') || sitemap.includes('localhost')) throw new Error('Production robots/sitemap configuration is invalid.');
  for (const required of [
    `property="og:image" content="${process.env.PUBLIC_SITE_ORIGIN}/brand/og-default-v2.jpg"`,
    'property="og:image:width" content="1200"',
    'property="og:image:height" content="630"',
    'property="og:image:alt"',
    'name="twitter:image:alt"',
  ]) {
    if (!homeHtml.includes(required)) throw new Error(`Production social metadata assertion failed: ${required}`);
  }
} else if (!robots.includes('Disallow: /')) {
  throw new Error('Builds without an approved production origin must remain non-indexable.');
}

console.log(
  `Verified ${files.length} public files and ${htmlFiles.length} HTML pages: routes, links, SEO shell, CV state and privacy checks passed.`,
);
