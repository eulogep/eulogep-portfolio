import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carouselProject } from '../../src/lib/carousel-projects';
import { getAllPublicProjects } from '../../src/lib/page-models';

describe('carousel public presentation adapter', () => {
  const projects = getAllPublicProjects();
  it('uses existing local media and preserves canonical project facts', () => {
    for (const project of projects) {
      const snapshot = JSON.stringify(project);
      const item = carouselProject(project);
      if (item.image) expect(existsSync(`public${item.image.src}`)).toBe(true);
      expect(item.title).toBe(project.title);
      expect(item.summary).toBe(project.summary);
      expect(item.status).toBe(project.status);
      expect(item.repository_url).toBe(project.repository_url);
      expect(JSON.stringify(project)).toBe(snapshot);
    }
  });
  it('does not invent captures or live demos', () => {
    expect(carouselProject(projects.find(p => p.project_id === 'project-ecv')!).image).toBeUndefined();
    for (const project of projects) expect(carouselProject(project).demoUrl).toBeUndefined();
  });
  it('accepts an explicitly supplied HTTPS demo and rejects unsafe schemes', () => {
    expect(carouselProject({ ...projects[0], demoUrl: 'https://example.org/' }).demoUrl).toBe('https://example.org/');
    expect(carouselProject({ ...projects[0], demoUrl: 'javascript:alert(1)' }).demoUrl).toBeUndefined();
  });
});
