import { describe, expect, it } from 'vitest';

import {
  getPrimaryProjects,
  getProjectDetailProjects,
  getRelatedProjects,
  getSecondaryFeaturedProjects,
  getSkillGroups,
} from '../../src/lib/page-models';

describe('public page models', () => {
  it('selects exactly three primary and four additional featured projects', () => {
    expect(getPrimaryProjects()).toHaveLength(3);
    expect(getSecondaryFeaturedProjects()).toHaveLength(4);
  });

  it('routes all featured projects and only sufficiently documented secondary projects', () => {
    const routes = getProjectDetailProjects();
    expect(routes.filter((project) => project.classification === 'FEATURED')).toHaveLength(7);
    expect(routes.map((project) => project.project_id)).toEqual(
      expect.arrayContaining(['project-ipgeo', 'project-euloge-tv', 'project-dex']),
    );
    expect(routes.map((project) => project.project_id)).not.toEqual(
      expect.arrayContaining(['project-facelens', 'project-pdf-fingerprint']),
    );
  });

  it('limits homepage skill evidence without percentages', () => {
    const skills = getSkillGroups(10).flatMap((group) => group.skills);
    expect(skills).toHaveLength(10);
    expect(skills.every((skill) => ['EXPOSURE', 'PRACTICED', 'APPLIED', 'REPEATEDLY_EVIDENCED'].includes(skill.level_label))).toBe(true);
  });

  it('returns at most two distinct related featured projects', () => {
    const [project] = getPrimaryProjects();
    const related = getRelatedProjects(project);
    expect(related).toHaveLength(2);
    expect(related.every((candidate) => candidate.project_id !== project.project_id)).toBe(true);
  });
});
