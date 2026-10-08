import { z } from 'zod';

export const claimStatusSchema = z.enum([
  'VERIFIED',
  'CORROBORATED',
  'INFERRED',
  'TO_VERIFY',
  'OUTDATED',
  'CONFLICTING',
  'PROPOSED',
  'UNKNOWN',
]);

export const privacyLevelSchema = z.enum(['PUBLIC', 'PORTFOLIO_SAFE', 'PUBLIC_SUMMARY_ONLY']);
export const skillLevelSchema = z.enum(['EXPOSURE', 'PRACTICED', 'APPLIED', 'REPEATEDLY_EVIDENCED']);
export const projectClassificationSchema = z.enum([
  'FEATURED',
  'FEATURED_CONTEXTUAL',
  'SECONDARY',
  'EXPERIMENTAL',
]);

const publicClaimSchema = z
  .object({
    claim_id: z.string().min(1),
    public_wording: z.string().min(1),
    status: claimStatusSchema,
    privacy_level: privacyLevelSchema,
    last_verified: z.string().date(),
    limitations: z.array(z.string().min(1)).optional(),
  })
  .strict();

const publicProjectSchema = z
  .object({
    project_id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    classification: projectClassificationSchema,
    homepage_priority: z.enum(['PRIMARY', 'SECONDARY', 'NONE']),
    order: z.number().int().positive(),
    summary: z.string().min(1).optional(),
    status: z.string().min(1),
    maturity: z.string().min(1).optional(),
    authorship: z.string().min(1),
    technologies: z.array(z.string().min(1)),
    capabilities: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    repository_url: z.string().url().startsWith('https://').optional(),
    last_verified: z.string().date().optional(),
    claim_ids: z.array(z.string().min(1)),
  })
  .strict();

const publicSkillSchema = z
  .object({
    skill_id: z.string().min(1),
    label: z.string().min(1),
    level_label: skillLevelSchema,
    public_project_ids: z.array(z.string().min(1)),
    limitation: z.string().min(1).optional(),
  })
  .strict();

const publicCertificationSchema = z
  .object({
    certification_id: z.string().regex(/^cert-[a-z0-9-]+$/),
    name: z.string().min(1),
    issuer: z.string().min(1),
    issued: z.string().min(1),
    status: z.literal('CORROBORATED'),
    proof_label: z.string().min(1),
    limitation: z.string().min(1),
    claim_id: z.string().regex(/^claim-cert-[a-z0-9-]+$/),
  })
  .strict();

export const publicPortfolioSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    identity_version: z.literal('2.1.1'),
    policy_version: z.literal('1.0.0'),
    locale: z.literal('fr'),
    profile: z
      .object({
        display_name: z.literal('Euloge Mabiala'),
        identity_tag: z.literal('eulogep'),
        summary: z.string().min(1),
        current_focus: z.string().min(1),
        claim_ids: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    positioning: z
      .object({
        label: z.string().min(1),
        status: claimStatusSchema,
        disclaimer: z.string().min(1).optional(),
      })
      .strict(),
    experience: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string().min(1),
          organization: z.string().min(1),
          period: z.string().min(1),
          summary: z.string().min(1),
          status: claimStatusSchema,
          claim_ids: z.array(z.string().min(1)).min(1),
          order: z.number().int().positive(),
        })
        .strict(),
    ),
    education: z.array(
      z
        .object({
          id: z.string().min(1),
          programme: z.string().min(1),
          institutions: z.array(z.string().min(1)).min(1),
          period: z.string().min(1),
          completion_state: z.literal('IN_PROGRESS'),
          status: claimStatusSchema,
          public_wording: z.string().min(1),
          claim_ids: z.array(z.string().min(1)).min(1),
          order: z.number().int().positive(),
        })
        .strict(),
    ),
    certifications: z.array(publicCertificationSchema).length(3),
    journey: z.array(
      z
        .object({
          id: z.string().min(1),
          period: z.string().min(1),
          eyebrow: z.string().min(1),
          title: z.string().min(1),
          summary: z.string().min(1),
          status: claimStatusSchema,
          proof_label: z.string().min(1),
          theme: z.enum(['FOUNDATION', 'ENGINEERING', 'PROJECTS', 'INDUSTRY']),
          claim_ids: z.array(z.string().min(1)).min(1),
          order: z.number().int().positive(),
        })
        .strict(),
    ).min(4),
    skills: z.array(publicSkillSchema),
    featured_projects: z.array(publicProjectSchema).length(7),
    secondary_projects: z.array(publicProjectSchema),
    safe_claims: z.array(publicClaimSchema),
    links: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1),
          url: z.string().url().startsWith('https://'),
          kind: z.enum(['GITHUB', 'REPOSITORY', 'DEPLOYMENT', 'CV', 'INTERNAL_ROUTE']),
          external: z.boolean(),
        })
        .strict(),
    ),
    contact: z
      .object({
        primary: z.literal('GITHUB'),
        label: z.string().min(1),
        url: z.literal('https://github.com/eulogep'),
      })
      .strict(),
    metadata: z
      .object({
        site_name: z.literal('Euloge Mabiala — Portfolio'),
        default_locale: z.literal('fr'),
        future_locales: z.array(z.literal('en')),
        featured_project_count: z.literal(7),
        primary_featured_ids: z.array(z.string().min(1)).length(3),
        canonical_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const featuredIds = new Set(value.featured_projects.map((project) => project.project_id));
    const primaryProjects = value.featured_projects.filter((project) => project.homepage_priority === 'PRIMARY');

    if (primaryProjects.length !== 3) {
      context.addIssue({ code: 'custom', message: 'Exactly three featured projects must be PRIMARY.' });
    }

    for (const projectId of value.metadata.primary_featured_ids) {
      if (!featuredIds.has(projectId)) {
        context.addIssue({ code: 'custom', message: `Primary project ${projectId} is not featured.` });
      }
    }
  });

export type PublicPortfolioView = z.infer<typeof publicPortfolioSchema>;
