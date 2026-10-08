import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compilePublicPortfolio } from '../../scripts/compile-public-portfolio';

const WORKSPACE = path.resolve(import.meta.dirname, '../..');

describe.skipIf(!existsSync(path.join(WORKSPACE, 'professional-identity.json')))('public identity compiler', () => {
  it('emits the approved project selection and priorities', async () => {
    const output = await compilePublicPortfolio();
    expect(output.featured_projects).toHaveLength(7);
    expect(output.featured_projects.filter((project) => project.homepage_priority === 'PRIMARY').map((project) => project.project_id)).toEqual([
      'project-elos',
      'project-professional-hub',
      'project-corrector-ai',
    ]);
    expect(output.secondary_projects.map((project) => project.project_id)).toEqual([
      'project-facelens',
      'project-ipgeo',
      'project-pdf-fingerprint',
      'project-euloge-tv',
      'project-dex',
    ]);
  });

  it('is deterministic for the same canonical inputs', async () => {
    const first = await compilePublicPortfolio();
    const second = await compilePublicPortfolio();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('preserves safe claim and project identifiers', async () => {
    const output = await compilePublicPortfolio();
    expect(output.safe_claims.map((claim) => claim.claim_id)).toContain('SAFE-014');
    expect(output.featured_projects.map((project) => project.project_id)).toContain('project-manga-wave');
  });

  it('publishes only the three corroborated, non-conflicting certifications', async () => {
    const output = await compilePublicPortfolio();
    expect(output.certifications).toHaveLength(3);
    expect(output.certifications.every((certification) => certification.status === 'CORROBORATED')).toBe(true);
    expect(output.certifications.map((certification) => certification.certification_id)).toEqual([
      'cert-ccna-srwe',
      'cert-airflow-3-fundamentals',
      'cert-unodc-cybercrime',
    ]);
    expect(JSON.stringify(output.certifications)).not.toMatch(/NASA|HackerRank|Proofpoint|InVivo/);
  });

  it('refuses a corroborated certification the owner has not cleared for publication', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'identity-'));
    try {
      await cp(path.join(WORKSPACE, 'professional-identity'), path.join(workspace, 'professional-identity'), { recursive: true });
      const identity = JSON.parse(await readFile(path.join(WORKSPACE, 'professional-identity.json'), 'utf8')) as {
        certifications: Array<{ name: string; publicly_reusable: boolean }>;
      };
      const ccna = identity.certifications.find((item) => item.name.startsWith('CCNA'));
      if (!ccna) throw new Error('fixture: CCNA certification missing');
      ccna.publicly_reusable = false;
      await writeFile(path.join(workspace, 'professional-identity.json'), JSON.stringify(identity));

      await expect(compilePublicPortfolio(workspace)).rejects.toThrow(/not cleared for publication/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
