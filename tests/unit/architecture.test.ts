import { describe, expect, it } from 'vitest';

import { assertPublicSafety } from '../../scripts/compile-public-portfolio';
import { architectureSpecs } from '../../src/data/architecture';
import { canvasSize, layoutDiagram, MAX_DIAGRAM_WIDTH, NODE_H, NODE_W, validateSpec, verticalSegments } from '../../src/lib/architecture/geometry';
import { getAllPublicProjects } from '../../src/lib/page-models';

describe('architecture specifications', () => {
  it.each(architectureSpecs.map((spec) => [spec.projectId, spec] as const))('%s is structurally valid', (_id, spec) => {
    expect(validateSpec(spec)).toEqual([]);
  });

  it('covers exactly the three scoped case studies', () => {
    expect(architectureSpecs.map((spec) => spec.projectId).sort()).toEqual([
      'project-corrector-ai',
      'project-elos',
      'project-professional-hub',
    ]);
  });

  it('only describes projects that exist in the public portfolio', () => {
    const publicIds = new Set(getAllPublicProjects().map((project) => project.project_id));
    for (const spec of architectureSpecs) expect(publicIds.has(spec.projectId)).toBe(true);
  });

  it('never carries an inferred relation', () => {
    for (const spec of architectureSpecs) {
      const levels = new Set([...spec.nodes.map((node) => node.evidence), ...spec.edges.map((edge) => edge.evidence)]);
      for (const level of levels) expect(['VERIFIED', 'CORROBORATED']).toContain(level);
    }
  });

  it('contains nothing the privacy gate rejects', () => {
    for (const spec of architectureSpecs) expect(() => assertPublicSafety(spec)).not.toThrow();
  });

  it('does not expose raw evidence identifiers or non-public activities', () => {
    const text = JSON.stringify(architectureSpecs);
    expect(text).not.toMatch(/\bev-[a-z0-9-]+\b/);
    expect(text).not.toMatch(/crous|soufflet|contacts?\b|birth|adresse|address/i);
  });

  it('marks fallback chains as sequential, never parallel', () => {
    const corrector = architectureSpecs.find((spec) => spec.projectId === 'project-corrector-ai')!;
    const fallbacks = corrector.edges.filter((edge) => edge.kind === 'fallback').map((edge) => `${edge.from}>${edge.to}`);
    expect(fallbacks).toEqual(['claude>deepseek', 'deepseek>gemini']);
    expect(corrector.stages.find((stage) => stage.sequence === 'fallback')?.nodeIds).toEqual(['claude', 'deepseek', 'gemini']);
    expect(JSON.stringify(corrector)).not.toMatch(/parall|simultan/i);
  });

  it('does not depict components that were not observed', () => {
    const elos = architectureSpecs.find((spec) => spec.projectId === 'project-elos')!;
    const nodeText = JSON.stringify(elos.nodes);
    expect(nodeText).not.toMatch(/prisma|sqlite|postgres/i);
    expect(elos.edges.some((edge) => edge.from === 'normalized' && edge.to === 'practice')).toBe(false);
  });
});
describe('architecture geometry', () => {
  it.each(architectureSpecs.map((spec) => [spec.projectId, spec] as const))('%s lays out inside its canvas without overlap', (_id, spec) => {
    const layout = layoutDiagram(spec);
    const { width, height } = canvasSize(spec.cols, spec.rows);
    expect(layout.width).toBe(width);
    expect(layout.height).toBe(height);

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(width);
      expect(node.y + node.height).toBeLessThanOrEqual(height);
      expect(node.width).toBe(NODE_W);
      expect(node.height).toBe(NODE_H);
    }
    for (const group of layout.groups) {
      expect(group.x).toBeGreaterThanOrEqual(0);
      expect(group.x + group.width).toBeLessThanOrEqual(width);
      expect(group.y).toBeGreaterThanOrEqual(0);
      expect(group.y + group.height).toBeLessThanOrEqual(height);
    }
  });

  it('rejects a spec whose edge would cross a third node', () => {
    const [spec] = architectureSpecs;
    const broken = { ...spec, edges: [...spec.edges, { from: 'sources', to: 'normalized', kind: 'flow' as const, evidence: 'VERIFIED' as const }] };
    expect(validateSpec(broken).join(' ')).toMatch(/skips a column/);
  });

  it('rejects an unstaged node and a missing text alternative', () => {
    const [spec] = architectureSpecs;
    const broken = { ...spec, stages: spec.stages.slice(0, 1), narrative: [] };
    const problems = validateSpec(broken).join(' ');
    expect(problems).toMatch(/exactly one stage/);
    expect(problems).toMatch(/text alternative/);
  });

  it('parses vertical stretches of straight and elbow paths', () => {
    expect(verticalSegments('M114 128V204')).toEqual([[114, 128, 204]]);
    expect(verticalSegments('M208 86H220V150H232')).toEqual([[220, 86, 150]]);
    expect(verticalSegments('M10 10H90')).toEqual([]);
  });

  it('refuses a layout where an edge runs through a group title', () => {
    const hub = architectureSpecs.find((spec) => spec.projectId === 'project-professional-hub')!;
    expect(validateSpec(hub)).toEqual([]);
    const upload = hub.groups.map((group) => (group.id === 'upload' ? { ...group, titleAlign: 'start' as const } : group));
    expect(validateSpec({ ...hub, groups: upload }).join(' ')).toMatch(/crosses the title of group "upload"/);
  });

  it('names the object storage exactly as approved and caps diagram size', () => {
    const hub = architectureSpecs.find((spec) => spec.projectId === 'project-professional-hub')!;
    const storage = hub.nodes.find((node) => node.id === 'objects')!;
    expect(storage.title).toBe('Cloudflare R2');
    expect(storage.lines.join(' ')).toBe('S3-compatible object storage ; envoi direct');
    expect(hub.narrative.join(' ')).toContain('Cloudflare R2 — S3-compatible object storage');
    expect(MAX_DIAGRAM_WIDTH).toBeLessThanOrEqual(1200);
  });
});
