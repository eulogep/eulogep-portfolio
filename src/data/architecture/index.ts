import type { ArchitectureSpec } from '../../lib/architecture/types';

import { correctorAiArchitecture } from './corrector-ai';
import { engineerLearningOsArchitecture } from './engineer-learning-os';
import { professionalHubArchitecture } from './professional-hub';

export const architectureSpecs: readonly ArchitectureSpec[] = [
  engineerLearningOsArchitecture,
  professionalHubArchitecture,
  correctorAiArchitecture,
];

export function getArchitectureSpec(projectId: string): ArchitectureSpec | undefined {
  return architectureSpecs.find((spec) => spec.projectId === projectId);
}
