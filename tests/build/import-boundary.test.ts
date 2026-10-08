import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(target) : [target];
    }),
  );
  return files.flat();
}

describe('UI import boundary', () => {
  it('has zero direct canonical identity imports', async () => {
    const roots = ['src/pages', 'src/layouts', 'src/components', 'src/lib'];
    const files = (await Promise.all(roots.map(filesBelow))).flat();
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (/professional-identity(?:\.json|\/)|identity-sources\//.test(content)) violations.push(file);
    }

    expect(violations).toEqual([]);
  });
});
