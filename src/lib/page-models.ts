import type { PublicPortfolioView } from '../types/public-portfolio';

import { getPublicPortfolio } from './public-data';

export type PublicProject = PublicPortfolioView['featured_projects'][number];
export type PublicSkill = PublicPortfolioView['skills'][number];

export interface SkillGroup {
  id: string;
  label: string;
  skills: PublicSkill[];
}

const portfolio = getPublicPortfolio();

const SKILL_GROUPS: ReadonlyArray<{ id: string; label: string; skillIds: readonly string[] }> = [
  {
    id: 'software-engineering',
    label: 'Software Engineering',
    skillIds: [
      'skill-fastapi',
      'skill-nextjs',
      'skill-react',
      'skill-sql',
      'skill-testing',
      'skill-typescript',
    ],
  },
  {
    id: 'ai-data',
    label: 'AI / Data',
    skillIds: ['skill-ai-validation', 'skill-data-analysis', 'skill-python'],
  },
  {
    id: 'infrastructure-devops',
    label: 'Infrastructure / DevOps',
    skillIds: ['skill-ci-cd', 'skill-docker', 'skill-supabase'],
  },
  {
    id: 'security',
    label: 'Security',
    skillIds: ['skill-postgresql-rls', 'skill-security'],
  },
  {
    id: 'industry-tools',
    label: 'Industry / Tools',
    skillIds: ['skill-industry40', 'skill-powerbi', 'skill-sap'],
  },
];

export const levelLabels: Readonly<Record<PublicSkill['level_label'], string>> = {
  EXPOSURE: 'Exposure',
  PRACTICED: 'Practiced',
  APPLIED: 'Applied',
  REPEATEDLY_EVIDENCED: 'Repeatedly evidenced',
};

export const authorshipLabels: Readonly<Record<string, string>> = {
  VERIFIED: 'Réalisation vérifiée',
  CORROBORATED: 'Réalisation corroborée',
  PARTIAL: 'Contribution partielle',
  TO_VERIFY: 'Attribution à confirmer',
};

/** Reader-facing wording for evidence statuses; raw enum values never reach the page. */
export const statusLabels: Readonly<Record<string, string>> = {
  VERIFIED: 'Vérifié',
  CORROBORATED: 'Corroboré',
  INFERRED: 'Déduit',
  TO_VERIFY: 'À confirmer',
  OUTDATED: 'Dépassé',
  CONFLICTING: 'En conflit',
};

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

export function getAllPublicProjects(): PublicProject[] {
  return [...portfolio.featured_projects, ...portfolio.secondary_projects];
}

export function getPrimaryProjects(): PublicProject[] {
  return portfolio.featured_projects.filter((project) => project.homepage_priority === 'PRIMARY');
}

export function getSecondaryFeaturedProjects(): PublicProject[] {
  return portfolio.featured_projects.filter((project) => project.homepage_priority === 'SECONDARY');
}

export function isProjectDetailEligible(project: PublicProject): boolean {
  return project.classification === 'FEATURED' || Boolean(project.summary) || project.capabilities.length > 0;
}

export function getProjectDetailProjects(): PublicProject[] {
  return getAllPublicProjects().filter(isProjectDetailEligible);
}

export function getProjectBySlug(slug: string): PublicProject | undefined {
  return getProjectDetailProjects().find((project) => project.slug === slug);
}

export function getRelatedProjects(project: PublicProject): PublicProject[] {
  const candidates = portfolio.featured_projects.filter((candidate) => candidate.project_id !== project.project_id);
  const currentIndex = portfolio.featured_projects.findIndex((candidate) => candidate.project_id === project.project_id);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;

  return [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)].slice(0, 2);
}

export function getSkillGroups(limit?: number): SkillGroup[] {
  const byId = new Map(portfolio.skills.map((skill) => [skill.skill_id, skill]));
  let remaining = limit ?? Number.POSITIVE_INFINITY;

  return SKILL_GROUPS.map((group) => {
    const skills = group.skillIds.flatMap((skillId) => {
      const skill = byId.get(skillId);
      return skill ? [skill] : [];
    });
    const selected = skills.slice(0, remaining);
    remaining -= selected.length;

    return { id: group.id, label: group.label, skills: selected };
  }).filter((group) => group.skills.length > 0);
}
