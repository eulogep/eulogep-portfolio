import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { compilePublicPortfolio } from '../../scripts/compile-public-portfolio';
import { publicPortfolioSchema } from '../../src/types/public-portfolio';

describe('PublicPortfolioView schema', () => {
  const publicOutput = async () => existsSync('professional-identity.json')
    ? compilePublicPortfolio()
    : publicPortfolioSchema.parse(JSON.parse(await readFile('src/data/generated/public-portfolio.json', 'utf8')));

  it('accepts the compiled canonical 2.1.1 projection', async () => {
    const output = await publicOutput();
    expect(publicPortfolioSchema.parse(output)).toEqual(output);
  });

  it('rejects unknown top-level fields', async () => {
    const output = await publicOutput();
    expect(() => publicPortfolioSchema.parse({ ...output, private_evidence: [] })).toThrow();
  });

  it('keeps historical narrative claims visibly qualified', async () => {
    const output = await publicOutput();
    const historical = output.journey.filter((item) => item.status === 'TO_VERIFY');
    expect(historical).toHaveLength(2);
    expect(historical.every((item) => item.proof_label.includes('à confirmer'))).toBe(true);
    expect(output.journey.at(-1)?.status).toBe('VERIFIED');
  });

  it('keeps certification evidence limitations visible', async () => {
    const output = await publicOutput();
    expect(output.certifications).toHaveLength(3);
    expect(output.certifications.every((certification) => certification.limitation.includes('encore à archiver'))).toBe(true);
  });
});
