import { describe, expect, it } from 'vitest';
import publicPortfolio from '../../src/data/generated/public-portfolio.json';
import { translationsBySource } from '../../src/i18n/fr-en';

describe('French and English display translations', () => {
  it('contains complete, non-empty language pairs', () => {
    expect(translationsBySource.size).toBeGreaterThan(100);
    for (const [source, pair] of translationsBySource) {
      expect(source.trim()).not.toBe('');
      expect(pair).toHaveLength(2);
      expect(pair[0].trim()).not.toBe('');
      expect(pair[1].trim()).not.toBe('');
    }
  });

  it('covers every public project summary without changing the canonical data', () => {
    const snapshot = JSON.stringify(publicPortfolio);
    for (const project of publicPortfolio.featured_projects) {
      const pair = translationsBySource.get(project.summary);
      expect(pair, `${project.title} summary`).toBeDefined();
      expect(pair?.[1]).toBe(project.summary);
    }
    expect(JSON.stringify(publicPortfolio)).toBe(snapshot);
  });

  it('translates the global navigation and language control in both directions', () => {
    expect(translationsBySource.get('Accueil')).toEqual(['Accueil', 'Home']);
    expect(translationsBySource.get('À propos')).toEqual(['À propos', 'About']);
    expect(translationsBySource.get('Choisir la langue du portfolio')).toEqual([
      'Choisir la langue du portfolio',
      'Choose portfolio language',
    ]);
  });
});
