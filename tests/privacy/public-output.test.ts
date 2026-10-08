import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { assertPublicSafety, compilePublicPortfolio } from '../../scripts/compile-public-portfolio';
import { publicPortfolioSchema } from '../../src/types/public-portfolio';

const workspaceRoot = process.cwd();

async function privateRepositoryNames(): Promise<string[]> {
  if (!existsSync(path.join(workspaceRoot, 'identity-sources/github/processed/repository-inventory.json'))) return [];
  const inventory = JSON.parse(
    await readFile(path.join(workspaceRoot, 'identity-sources/github/processed/repository-inventory.json'), 'utf8'),
  ) as { repositories: Array<{ repository_name: string; visibility: string }> };
  return inventory.repositories.filter((repository) => repository.visibility === 'PRIVATE').map((repository) => repository.repository_name);
}

describe('public output privacy gate', () => {
  const publicOutput = async () => existsSync('professional-identity.json')
    ? compilePublicPortfolio()
    : publicPortfolioSchema.parse(JSON.parse(await readFile('src/data/generated/public-portfolio.json', 'utf8')));

  it('contains none of the private repository names from the audited inventory', async () => {
    const output = await publicOutput();
    const privateNames = await privateRepositoryNames();
    expect(() => assertPublicSafety(output, privateNames)).not.toThrow();
  });

  it.each([
    ['private email', { summary: 'Contact: owner.private@example.invalid' }],
    ['private phone', { summary: '+33 6 12 34 56 78' }],
    ['residence address field', { residence_address: 'private fixture' }],
    ['birthplace field', { birthplace: 'private fixture' }],
    ['administrative identifier', { administrative_identifier: 'fixture-123' }],
    ['internal note', { internal_note: 'private fixture' }],
    ['sensitive evidence field', { evidence_ids: ['internal-only'] }],
    ['private totals', { summary: '106 repositories including 45 private repositories' }],
  ])('rejects an injected %s', async (_label, fixture) => {
    expect(() => assertPublicSafety(fixture)).toThrow();
  });

  it.skipIf(!existsSync(path.join(workspaceRoot, 'identity-sources/github/processed/repository-inventory.json')))('rejects an injected private repository name', async () => {
    const [privateName] = await privateRepositoryNames();
    expect(() => assertPublicSafety({ title: privateName }, [privateName])).toThrow();
  });
});
