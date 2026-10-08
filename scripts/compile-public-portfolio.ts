import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

import { publicPortfolioSchema, type PublicPortfolioView } from '../src/types/public-portfolio';

const WORKSPACE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_OUTPUT = path.join(WORKSPACE_ROOT, 'src/data/generated/public-portfolio.json');

const claimStatus = z.enum([
  'VERIFIED',
  'CORROBORATED',
  'INFERRED',
  'TO_VERIFY',
  'OUTDATED',
  'CONFLICTING',
  'PROPOSED',
  'UNKNOWN',
]);

const canonicalSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    identity_version: z.literal('2.1.1'),
    owner_display_name: z.literal('Euloge Mabiala'),
    owner_identity_tag: z.literal('eulogep'),
    validation_state: z.literal('CANONICAL'),
    positioning: z.object({ label: z.string().min(1), status: claimStatus }),
    current_state: z.object({
      work: z.object({
        organization: z.string().min(1),
        public_title: z.string().min(1),
        public_period: z.string().min(1),
        public_scope: z.array(z.string().min(1)).min(1),
        activity_status: claimStatus,
      }),
      education: z.object({
        programme: z.string().min(1),
        institutions: z.array(z.string().min(1)).min(1),
        date_range: z.string().min(1),
        status: claimStatus,
        public_wording: z.string().min(1),
      }),
    }),
    links: z.object({
      github: z.literal('https://github.com/eulogep'),
      public_contact: z.object({ channel: z.literal('GitHub'), url: z.literal('https://github.com/eulogep') }),
    }),
    prior_education: z.array(
      z.object({
        institution: z.string().min(1),
        public_wording: z.string().min(1),
        history_status: claimStatus,
        publicly_reusable: z.boolean(),
      }).passthrough(),
    ),
    certifications: z.array(
      z.object({
        name: z.string().min(1),
        status: claimStatus,
        publicly_reusable: z.boolean(),
      }).passthrough(),
    ),
  })
  .passthrough();

const safeClaimSchema = z
  .object({
    claim_id: z.string().min(1),
    wording: z.string().min(1),
    public_wording: z.string().min(1).optional(),
    status: claimStatus,
    privacy_level: z.string().min(1),
    last_verified: z.string().date(),
    limitations: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

const projectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    classification: z.string().min(1),
    repository: z.string().url().optional(),
    visibility: z.string().optional(),
    privacy_level: z.string().optional(),
    authorship: z.string().min(1),
    status: z.string().min(1),
    maturity: z.string().optional(),
    stack: z.array(z.string().min(1)).optional(),
    verified_capabilities: z.array(z.string().min(1)).optional(),
    limitations: z.array(z.string().min(1)).optional(),
    last_verified: z.string().date().optional(),
  })
  .passthrough();

const skillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    level_label: z.enum(['EXPOSURE', 'PRACTICED', 'APPLIED', 'REPEATEDLY_EVIDENCED']),
    project_ids: z.array(z.string().min(1)),
    limitation: z.string().min(1).optional(),
  })
  .passthrough();

const historicalClaimSchema = z
  .object({
    id: z.string().min(1),
    claim: z.string().min(1),
    status: claimStatus,
    public_wording: z.string().min(1).optional(),
    privacy_level: z.string().min(1),
  })
  .passthrough();

const shortlistSchema = z.object({
  featured: z.array(z.string().min(1)).length(7),
  secondary: z.array(z.string().min(1)),
  project_family_review_status: z.literal('DEFERRED'),
  requires_owner_review: z.literal(true),
});

const PRIMARY_PROJECTS = ['project-elos', 'project-professional-hub', 'project-corrector-ai'] as const;
const PROJECT_CLAIMS: Record<string, string> = {
  'project-elos': 'SAFE-005',
  'project-professional-hub': 'SAFE-006',
  'project-corrector-ai': 'SAFE-007',
  'project-mentor-evolution': 'SAFE-008',
  'project-classeur': 'SAFE-009',
  'project-ecv': 'SAFE-013',
  'project-manga-wave': 'SAFE-014',
};
const PROJECT_SLUGS: Record<string, string> = {
  'project-elos': 'engineer-learning-os',
  'project-professional-hub': 'professional-hub',
  'project-corrector-ai': 'corrector-ai',
  'project-mentor-evolution': 'mentor-evolution',
  'project-classeur': 'classeur-numerique-intelligent',
  'project-ecv': 'ecv',
  'project-manga-wave': 'manga-wave',
  'project-facelens': 'facelens',
  'project-ipgeo': 'ip-geolocation-app',
  'project-pdf-fingerprint': 'pdf-fingerprint-engine',
  'project-euloge-tv': 'euloge-tv',
  'project-dex': 'dex',
};
const PUBLIC_TITLES: Record<string, string> = {
  'project-classeur': 'Classeur Numérique Intelligent',
};

const PUBLIC_CERTIFICATIONS = {
  'CCNA Switching, Routing and Wireless Essentials': {
    certification_id: 'cert-ccna-srwe',
    issuer: 'Cisco · Cisco Networking Academy',
    issued: 'Mars 2026',
    claim_id: 'claim-cert-ccna',
  },
  'Astronomer Certification for Apache Airflow 3 Fundamentals': {
    certification_id: 'cert-airflow-3-fundamentals',
    issuer: 'Astronomer',
    issued: 'Septembre 2025',
    claim_id: 'claim-cert-airflow',
  },
  'UNODC cybercrime e-learning training': {
    certification_id: 'cert-unodc-cybercrime',
    issuer: 'Office des Nations unies contre la drogue et le crime',
    issued: 'Décembre 2025',
    claim_id: 'claim-cert-unodc',
  },
} as const;
const ALLOWED_PRIVACY = new Set(['PUBLIC', 'PORTFOLIO_SAFE', 'PUBLIC_SUMMARY_ONLY']);
const FORBIDDEN_KEY = /(email|phone|telephone|address|birthplace|administrative|internal_note|correction_note|source_ids|evidence_ids|audit)/i;
const PRIVATE_INVENTORY_PATTERN = /(?:106\s+(?:total\s+)?repositories|45\s+private|106\s+repositories)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:(?:\+33|0033)[ .-]?[1-9]|0[1-9])(?:[ .-]?\d{2}){4}/;

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function assertUnique(items: readonly string[], label: string): void {
  const duplicate = items.find((item, index) => items.indexOf(item) !== index);
  if (duplicate) throw new Error(`Duplicate ${label} id: ${duplicate}`);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function serialize(value: PublicPortfolioView): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function assertPublicSafety(value: unknown, privateNames: readonly string[] = []): void {
  const visit = (node: unknown, keyPath: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${keyPath}[${index}]`));
      return;
    }

    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (FORBIDDEN_KEY.test(key)) throw new Error(`Forbidden public field at ${keyPath}.${key}`);
        visit(child, `${keyPath}.${key}`);
      }
      return;
    }

    if (typeof node !== 'string') return;
    if (EMAIL_PATTERN.test(node)) throw new Error(`Email-like value in public output at ${keyPath}`);
    if (PHONE_PATTERN.test(node)) throw new Error(`Phone-like value in public output at ${keyPath}`);
    if (PRIVATE_INVENTORY_PATTERN.test(node)) throw new Error(`Private GitHub inventory wording at ${keyPath}`);
    for (const privateName of privateNames) {
      const normalizedName = privateName.trim().toLocaleLowerCase('en');
      const normalizedNode = node.trim().toLocaleLowerCase('en');
      const distinctiveName = normalizedName.length >= 12 || /[-_\d]/.test(normalizedName);
      const nameLeaked =
        normalizedName.length > 0 &&
        (normalizedNode === normalizedName ||
          normalizedNode.includes(`github.com/eulogep/${normalizedName}`) ||
          (distinctiveName && normalizedNode.includes(normalizedName)));
      if (nameLeaked) {
        throw new Error(`Private repository name in public output at ${keyPath}`);
      }
    }
  };

  visit(value, '$');
}

export async function compilePublicPortfolio(workspaceRoot = WORKSPACE_ROOT): Promise<PublicPortfolioView> {
  const rootPath = path.join(workspaceRoot, 'professional-identity.json');
  const [rootText, canonicalRaw, claimsRaw, projectsRaw, skillsRaw, shortlistRaw, corroboratedRaw, toVerifyRaw] = await Promise.all([
    readFile(rootPath, 'utf8'),
    readJson(rootPath),
    readJson(path.join(workspaceRoot, 'professional-identity/generated/safe-portfolio-claims.json')),
    readJson(path.join(workspaceRoot, 'professional-identity/evidence/project-evidence.json')),
    readJson(path.join(workspaceRoot, 'professional-identity/evidence/skill-evidence.json')),
    readJson(path.join(workspaceRoot, 'professional-identity/generated/project-shortlist.json')),
    readJson(path.join(workspaceRoot, 'professional-identity/claims/corroborated-claims.json')),
    readJson(path.join(workspaceRoot, 'professional-identity/claims/claims-to-verify.json')),
  ]);

  const canonical = canonicalSchema.parse(canonicalRaw);
  const claims = z.object({ claims: z.array(safeClaimSchema) }).parse(claimsRaw).claims;
  const projects = z.object({ projects: z.array(projectSchema) }).parse(projectsRaw).projects;
  const skills = z.object({ skills: z.array(skillSchema) }).parse(skillsRaw).skills;
  const shortlist = shortlistSchema.parse(shortlistRaw);
  const corroboratedClaims = z.object({ claims: z.array(historicalClaimSchema) }).parse(corroboratedRaw).claims;
  const toVerifyClaims = z.object({ claims: z.array(historicalClaimSchema) }).parse(toVerifyRaw).claims;

  assertUnique(claims.map((claim) => claim.claim_id), 'claim');
  assertUnique(projects.map((project) => project.id), 'project');
  assertUnique(skills.map((skill) => skill.id), 'skill');

  const claimsById = new Map(claims.map((claim) => [claim.claim_id, claim]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const publicProjectIds = new Set([...shortlist.featured, ...shortlist.secondary]);
  const privateNames = projects
    .filter((project) => project.visibility === 'PRIVATE' || project.privacy_level === 'PRIVATE')
    .map((project) => project.name);

  const publicClaims = claims
    .filter((claim) => ALLOWED_PRIVACY.has(claim.privacy_level))
    .map((claim) => ({
      claim_id: claim.claim_id,
      public_wording: claim.public_wording ?? claim.wording,
      status: claim.status,
      privacy_level: claim.privacy_level as 'PUBLIC' | 'PORTFOLIO_SAFE' | 'PUBLIC_SUMMARY_ONLY',
      last_verified: claim.last_verified,
      ...(claim.limitations ? { limitations: claim.limitations } : {}),
    }))
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));

  const mapProject = (projectId: string, order: number, featured: boolean) => {
    const project = projectsById.get(projectId);
    if (!project) throw new Error(`Missing shortlisted project: ${projectId}`);
    if (project.visibility === 'PRIVATE' || project.privacy_level === 'PRIVATE') {
      throw new Error(`Private project cannot be shortlisted: ${projectId}`);
    }
    const slug = PROJECT_SLUGS[projectId];
    if (!slug) throw new Error(`Missing public slug for ${projectId}`);
    const claimId = PROJECT_CLAIMS[projectId];
    const safeClaim = claimId ? claimsById.get(claimId) : undefined;
    if (featured && !safeClaim) throw new Error(`Featured project ${projectId} has no safe claim.`);
    if (safeClaim && !ALLOWED_PRIVACY.has(safeClaim.privacy_level)) {
      throw new Error(`Project ${projectId} references a non-public claim.`);
    }

    return {
      project_id: project.id,
      slug,
      title: PUBLIC_TITLES[project.id] ?? project.name,
      classification: project.classification as 'FEATURED' | 'FEATURED_CONTEXTUAL' | 'SECONDARY' | 'EXPERIMENTAL',
      homepage_priority: PRIMARY_PROJECTS.includes(project.id as (typeof PRIMARY_PROJECTS)[number])
        ? ('PRIMARY' as const)
        : featured
          ? ('SECONDARY' as const)
          : ('NONE' as const),
      order,
      ...(safeClaim ? { summary: safeClaim.public_wording ?? safeClaim.wording } : {}),
      status: project.status,
      ...(project.maturity ? { maturity: project.maturity } : {}),
      authorship: project.authorship,
      technologies: project.stack ?? [],
      capabilities: project.verified_capabilities ?? [],
      limitations: project.limitations ?? [],
      ...(project.repository?.startsWith('https://') ? { repository_url: project.repository } : {}),
      ...(project.last_verified ? { last_verified: project.last_verified } : {}),
      claim_ids: claimId ? [claimId] : [],
    };
  };

  const featuredProjects = shortlist.featured.map((projectId, index) => mapProject(projectId, index + 1, true));
  const secondaryProjects = shortlist.secondary.map((projectId, index) => mapProject(projectId, index + 1, false));

  const publicSkills = skills
    .map((skill) => ({
      skill_id: skill.id,
      label: skill.name,
      level_label: skill.level_label,
      public_project_ids: skill.project_ids.filter((projectId) => publicProjectIds.has(projectId)).sort(),
      ...(skill.limitation ? { limitation: skill.limitation } : {}),
    }))
    .sort((a, b) => a.skill_id.localeCompare(b.skill_id));

  const summary = claimsById.get('SAFE-001');
  const focus = claimsById.get('SAFE-003');
  if (!summary || !focus) throw new Error('Required public profile claims are missing.');

  const historicalClaimsById = new Map(
    [...corroboratedClaims, ...toVerifyClaims].map((claim) => [claim.id, claim]),
  );
  const requiredHistoricalClaim = (claimId: string) => {
    const claim = historicalClaimsById.get(claimId);
    if (!claim) throw new Error(`Required historical claim is missing: ${claimId}`);
    return claim;
  };
  const baccalaureate = requiredHistoricalClaim('claim-baccalaureate');
  const cpge = requiredHistoricalClaim('claim-cpge');
  const esiea = requiredHistoricalClaim('claim-esiea-history');
  const publicCertifications = Object.entries(PUBLIC_CERTIFICATIONS).map(([name, publication]) => {
    const certification = canonical.certifications.find((item) => item.name === name);
    const claim = corroboratedClaims.find((item) => item.id === publication.claim_id);
    if (!certification || !claim || certification.status !== 'CORROBORATED' || claim.status !== 'CORROBORATED') {
      throw new Error(`Certification is not safely corroborated: ${name}`);
    }
    // Corroboration is necessary but not sufficient: the owner must also have cleared it for publication.
    if (!certification.publicly_reusable) {
      throw new Error(`Certification is not cleared for publication by the owner: ${name}`);
    }
    return {
      certification_id: publication.certification_id,
      name,
      issuer: publication.issuer,
      issued: publication.issued,
      status: 'CORROBORATED' as const,
      proof_label: 'CV historique et profil LinkedIn public concordants',
      limitation: 'Badge ou certificat direct encore à archiver dans le registre de preuves.',
      claim_id: publication.claim_id,
    };
  });

  const candidate: PublicPortfolioView = {
    schema_version: '1.0.0',
    identity_version: canonical.identity_version,
    policy_version: '1.0.0',
    locale: 'fr',
    profile: {
      display_name: canonical.owner_display_name,
      identity_tag: canonical.owner_identity_tag,
      summary: summary.public_wording ?? summary.wording,
      current_focus: focus.public_wording ?? focus.wording,
      claim_ids: ['SAFE-001', 'SAFE-003'],
    },
    positioning: {
      label: canonical.positioning.label,
      status: canonical.positioning.status,
      disclaimer: "Positionnement professionnel sélectionné par le propriétaire, et non intitulé d'emploi officiel.",
    },
    experience: [
      {
        id: 'experience-soufflet-current',
        title: canonical.current_state.work.public_title,
        organization: canonical.current_state.work.organization,
        period: canonical.current_state.work.public_period,
        summary: canonical.current_state.work.public_scope.join(', '),
        status: canonical.current_state.work.activity_status,
        claim_ids: ['SAFE-003', 'SAFE-004'],
        order: 1,
      },
    ],
    education: [
      {
        id: 'education-cy-2026-2027',
        programme: canonical.current_state.education.programme,
        institutions: canonical.current_state.education.institutions,
        period: canonical.current_state.education.date_range,
        completion_state: 'IN_PROGRESS',
        status: canonical.current_state.education.status,
        public_wording: canonical.current_state.education.public_wording,
        claim_ids: ['SAFE-002'],
        order: 1,
      },
    ],
    certifications: publicCertifications,
    journey: [
      {
        id: 'journey-baccalaureate',
        period: '2021',
        eyebrow: 'Fondations scientifiques',
        title: 'Baccalauréat général',
        summary: 'Mention Bien, spécialités mathématiques et physique — information issue du CV historique et encore à confirmer par un document académique.',
        status: baccalaureate.status,
        proof_label: 'Archive personnelle · à confirmer',
        theme: 'FOUNDATION',
        claim_ids: [baccalaureate.id],
        order: 1,
      },
      {
        id: 'journey-cpge',
        period: '2021 — 2024',
        eyebrow: 'Méthode et intensité',
        title: 'CPGE MPSI / PSI',
        summary: 'Un parcours scientifique déclaré dans le CV historique. Le jalon est conservé comme repère narratif, sans le présenter comme un diplôme vérifié.',
        status: cpge.status,
        proof_label: 'Archive personnelle · à confirmer',
        theme: 'FOUNDATION',
        claim_ids: [cpge.id],
        order: 2,
      },
      {
        id: 'journey-esiea',
        period: 'Étape suivante',
        eyebrow: 'Passage à l’ingénierie',
        title: esiea.public_wording ?? 'Formation antérieure : ESIEA',
        summary: 'Une étape antérieure en informatique et ingénierie. Les dates restent volontairement absentes tant que la chronologie n’est pas consolidée.',
        status: esiea.status,
        proof_label: 'Parcours corroboré · dates non publiées',
        theme: 'ENGINEERING',
        claim_ids: [esiea.id],
        order: 3,
      },
      {
        id: 'journey-projects',
        period: 'En parallèle',
        eyebrow: 'Apprendre en construisant',
        title: 'Les projets comme laboratoire',
        summary: 'Applications d’apprentissage, outils de données, validation de sorties IA, sécurité et produits full-stack : les dépôts publics rendent la progression inspectable.',
        status: 'VERIFIED',
        proof_label: 'Dépôts publics inspectés',
        theme: 'PROJECTS',
        claim_ids: ['SAFE-005', 'SAFE-006', 'SAFE-007', 'SAFE-011'],
        order: 4,
      },
      {
        id: 'journey-cy-tech',
        period: canonical.current_state.education.date_range,
        eyebrow: 'Réseaux et cybersécurité',
        title: 'CY Tech · Formasup',
        summary: canonical.current_state.education.public_wording,
        status: canonical.current_state.education.status,
        proof_label: 'Formation en cours · corroborée',
        theme: 'ENGINEERING',
        claim_ids: ['SAFE-002'],
        order: 5,
      },
      {
        id: 'journey-industry',
        period: canonical.current_state.work.public_period,
        eyebrow: 'Systèmes dans le monde réel',
        title: 'Industrie 4.0 chez Soufflet Malt',
        summary: 'Déploiement de cas d’usage, tests fonctionnels, données industrielles, suivi de KPI et accompagnement de l’adoption.',
        status: canonical.current_state.work.activity_status,
        proof_label: 'Périmètre professionnel vérifié',
        theme: 'INDUSTRY',
        claim_ids: ['SAFE-003', 'SAFE-004'],
        order: 6,
      },
    ],
    skills: publicSkills,
    featured_projects: featuredProjects,
    secondary_projects: secondaryProjects,
    safe_claims: publicClaims,
    links: [
      {
        id: 'link-github',
        label: 'GitHub',
        url: canonical.links.github,
        kind: 'GITHUB',
        external: true,
      },
    ],
    contact: {
      primary: 'GITHUB',
      label: 'Voir le profil GitHub',
      url: canonical.links.public_contact.url,
    },
    metadata: {
      site_name: 'Euloge Mabiala — Portfolio',
      default_locale: 'fr',
      future_locales: ['en'],
      featured_project_count: 7,
      primary_featured_ids: [...PRIMARY_PROJECTS],
      canonical_sha256: sha256(rootText),
    },
  };

  const result = publicPortfolioSchema.parse(candidate);
  assertPublicSafety(result, privateNames);
  return result;
}

async function run(): Promise<void> {
  const checkOnly = process.argv.includes('--check');

  // Public source checkouts intentionally contain only the reviewed projection.
  // The private workspace still performs the stronger canonical regeneration check.
  if (checkOnly && !existsSync(path.join(WORKSPACE_ROOT, 'professional-identity.json'))) {
    const snapshot = publicPortfolioSchema.parse(await readJson(DEFAULT_OUTPUT));
    assertPublicSafety(snapshot);
    console.log('Public portfolio snapshot is schema-valid and privacy-safe.');
    return;
  }

  const output = await compilePublicPortfolio();
  const serialized = serialize(output);

  if (checkOnly) {
    const existing = await readFile(DEFAULT_OUTPUT, 'utf8').catch(() => '');
    if (existing !== serialized) throw new Error('Generated public portfolio data is missing or stale.');
    console.log('Public portfolio data is valid, private-safe and current.');
    return;
  }

  const temporaryOutput = `${DEFAULT_OUTPUT}.tmp`;
  await writeFile(temporaryOutput, serialized, 'utf8');
  await rename(temporaryOutput, DEFAULT_OUTPUT);
  console.log('Generated src/data/generated/public-portfolio.json');
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown compiler failure';
    console.error(`PUBLIC_COMPILER_FAILURE: ${message}`);
    process.exitCode = 1;
  });
}
