import { access } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { assertPublicSafety } from '../../scripts/compile-public-portfolio';
import { allAssets, allCaptures, evidenceItems, getEvidenceAsset } from '../../src/data/visual-evidence';
import type { EvidenceItem } from '../../src/lib/visual-evidence/types';
import { getAllPublicProjects } from '../../src/lib/page-models';

const publicRoot = path.join(process.cwd(), 'public/evidence');
const allowedTypes = ['REAL_UI', 'REAL_TEST_OUTPUT', 'REAL_CODE_EVIDENCE', 'REAL_ARCHITECTURE', 'REAL_DATA_OUTPUT', 'DOCUMENTATION'];
const allowedLabels = ['LIVE UI', 'IMPLEMENTATION', 'TEST', 'VALIDATION', 'ARCHITECTURE'];

const proseOf = (item: EvidenceItem): string => [item.caption, item.context ?? '', 'redaction' in item ? (item.redaction ?? '') : ''].join(' ');
const fileExists = (file: string) => access(file).then(() => true, () => false);

describe('visual evidence manifest', () => {
  it('covers exactly the three scoped case studies, all public', () => {
    const publicIds = new Set(getAllPublicProjects().map((project) => project.project_id));
    const covered = [...new Set(evidenceItems.map((item) => item.projectId))].sort();
    expect(covered).toEqual(['project-corrector-ai', 'project-elos', 'project-professional-hub']);
    for (const id of covered) expect(publicIds.has(id)).toBe(true);
  });

  it('uses only proof classifications and factual labels (never decorative, never a verdict)', () => {
    for (const item of evidenceItems) {
      expect(allowedTypes).toContain(item.evidenceType);
      expect(allowedLabels).toContain(item.label);
    }
  });

  it('gives every item an evidence caption and a source, free of superlatives', () => {
    for (const item of evidenceItems) {
      expect(item.caption.length).toBeGreaterThan(40);
      expect(item.source.length).toBeGreaterThan(10);
      expect(proseOf(item)).not.toMatch(/powerful|puissant|state[- ]of[- ]the[- ]art|enterprise|production[- ]ready|100\s?%|proof verified|preuve vérifiée|militaire|inviolable/i);
    }
  });

  it('never states a project-wide test total in prose', () => {
    for (const item of evidenceItems) expect(proseOf(item)).not.toMatch(/\b\d+\s+(tests?|suites?)\b/i);
  });

  it('only mentions parallel or simultaneous provider use to deny it', () => {
    for (const item of evidenceItems) {
      for (const sentence of proseOf(item).split(/(?<=[.;])\s+/)) {
        if (/parall[eè]le|simultan/i.test(sentence)) expect(sentence).toMatch(/jamais|pas/i);
      }
    }
  });

  it('names the object storage exactly as approved and exposes no storage identifiers', () => {
    const text = JSON.stringify(evidenceItems) + JSON.stringify(allCaptures);
    expect(text).toContain('Cloudflare R2 — S3-compatible object storage');
    expect(text).not.toMatch(/cloudflarestorage|bucket|R2_ACCOUNT|R2_ACCESS/i);
  });

  it('passes the public privacy gate and contains no path, address, IP or credential shape', () => {
    expect(() => assertPublicSafety({ evidenceItems, captures: allCaptures })).not.toThrow();
    const text = JSON.stringify({ evidenceItems, captures: allCaptures });
    expect(text).not.toMatch(/\/Users\/|\/private\/|\/tmp\/|127\.0\.0\.1|localhost|@[a-z0-9-]+\.[a-z]{2,}|sb_(publishable|secret)|eyJ[a-zA-Z0-9]/i);
    expect(text).not.toMatch(/\bev-[a-z0-9-]+\b/);
  });

  it('keeps alt text meaningful and distinct from the caption', () => {
    for (const item of evidenceItems) {
      if (item.kind !== 'image') continue;
      expect(item.alt.length).toBeGreaterThan(50);
      expect(item.alt).not.toBe(item.caption);
    }
  });

  it('references only captured text that exists', () => {
    for (const item of evidenceItems) {
      const ids = item.kind === 'log' ? item.runs.map((run) => run.captureId) : item.kind === 'code' ? [item.captureId] : [];
      for (const id of ids) expect(allCaptures[id]?.lines.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('visual evidence assets', () => {
  it('backs every image item with a generated asset', () => {
    for (const item of evidenceItems) if (item.kind === 'image') expect(() => getEvidenceAsset(item.assetId)).not.toThrow();
  });

  it.each(allAssets.map((asset) => [asset.id, asset] as const))('%s exists at its declared dimensions, without upscaling or metadata', async (_id, asset) => {
    expect(asset.widths.at(-1)).toBe(asset.width);
    expect(Math.max(...asset.widths)).toBeLessThanOrEqual(asset.width);

    for (const width of asset.widths) {
      const file = path.join(publicRoot, asset.project, `${asset.name}-${width}.avif`);
      expect(await fileExists(file)).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(width);
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
    }
    const fallback = await sharp(path.join(publicRoot, asset.project, `${asset.name}-${asset.width}.webp`)).metadata();
    expect([fallback.width, fallback.height]).toEqual([asset.width, asset.height]);
    expect(fallback.exif).toBeUndefined();
  });
});
