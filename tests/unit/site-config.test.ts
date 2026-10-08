import { describe, expect, it } from 'vitest';

import { getSiteOrigin, toCanonicalUrl } from '../../src/lib/site-config';

describe('site origin and canonical URLs', () => {
  it('normalizes an approved HTTPS production origin', () => {
    expect(getSiteOrigin('https://portfolio.example/path')).toBe('https://portfolio.example');
    expect(toCanonicalUrl('/projects/', 'https://portfolio.example')).toBe('https://portfolio.example/projects/');
  });

  it('rejects an insecure production origin', () => {
    expect(() => getSiteOrigin('http://portfolio.example')).toThrow('must use HTTPS');
  });

  it('recognizes a missing production origin', () => {
    expect(getSiteOrigin('')).toBeUndefined();
  });
});
