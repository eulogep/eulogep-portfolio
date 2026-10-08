import type { ArchitectureSpec } from '../../lib/architecture/types';

/*
 * Drawn from the public Engineer-Learning-OS repository (src/modules/*), inspected 2026-09-26.
 * Deliberately absent: Prisma and any database (declared as a dependency but not used by
 * the modules read), and any link from document extraction to the practice modules (no
 * such call was observed). docs/ARCHITECTURE.md describes a *target* and is not used as proof.
 */
export const engineerLearningOsArchitecture: ArchitectureSpec = {
  projectId: 'project-elos',
  title: 'Architecture d’Engineer Learning OS',
  summary:
    'Deux chaînes indépendantes : l’extraction documentaire locale (routage vers PDF.js ou Docling, cache) et la chaîne pratique, preuves, compétences et révision espacée, persistée dans le navigateur.',
  narrative: [
    'Entrée : des documents sources (PDF, DOCX, PPTX, XLSX) et des missions ou quiz de pratique.',
    'Extraction locale : un routeur choisit PDF.js pour un PDF texte simple ou Docling pour les mises en page complexes, tableaux et formats bureautiques ; sans Docling, un PDF complexe passe en repli PDF.js de qualité dégradée.',
    'Refus explicite : un PDF scanné n’est pas extrait, le routeur signale qu’un OCR est requis.',
    'Stockage documentaire : le document normalisé (pages, blocs, qualité) est mis en cache dans un fichier local, indexé par empreinte du source, extracteur, version et options.',
    'Validation côté pratique : les quiz sur supports exigent des pages ou citations, vérifiées de façon déterministe.',
    'Preuves : chaque tentative produit un EvidenceRecord, d’où est dérivé un statut de compétence sur six niveaux, de NOT_SEEN à RETAINED.',
    'Révision : les erreurs deviennent des signaux, regroupés en schémas, puis en items de révision espacée. Preuves et révision sont persistées dans le navigateur et affichées par les pages Preuves, Progression et Révision.',
  ],
  cols: 4,
  rows: 4,
  nodes: [
    { id: 'sources', col: 0, row: 0, kind: 'input', title: 'Documents sources', lines: ['PDF · DOCX · PPTX · XLSX'], evidence: 'VERIFIED' },
    { id: 'router', col: 1, row: 0, kind: 'process', title: 'Routage', lines: ['selon format, mise en page,', 'tableaux et formules'], evidence: 'VERIFIED' },
    { id: 'pdfjs', col: 2, row: 0, kind: 'process', title: 'PDF.js', lines: ['PDF texte simple ;', 'repli si Docling absent'], evidence: 'VERIFIED' },
    { id: 'normalized', col: 3, row: 0, kind: 'output', title: 'Document normalisé', lines: ['pages, blocs,', 'qualité FAILED → HIGH'], evidence: 'VERIFIED' },
    { id: 'refusal', col: 1, row: 1, kind: 'validation', title: 'Refus explicite', lines: ['PDF scanné : OCR requis,', 'aucune extraction'], evidence: 'VERIFIED' },
    { id: 'docling', col: 2, row: 1, kind: 'process', title: 'Docling', lines: ['structure, tableaux ;', 'processus local borné'], optional: true, evidence: 'VERIFIED' },
    { id: 'cache', col: 3, row: 1, kind: 'store', title: 'Cache fichier local', lines: ['clé : empreinte du source,', 'extracteur, options'], evidence: 'VERIFIED' },
    { id: 'practice', col: 0, row: 2, kind: 'validation', title: 'Missions et quiz', lines: ['quiz : pages ou citations', 'exigées (contrôle strict)'], evidence: 'VERIFIED' },
    { id: 'evidence', col: 1, row: 2, kind: 'store', title: 'EvidenceRecord', lines: ['preuve horodatée,', 'aide et essais tracés'], evidence: 'VERIFIED' },
    { id: 'competency', col: 2, row: 2, kind: 'process', title: 'Statut de compétence', lines: ['6 niveaux, de NOT_SEEN', 'à RETAINED'], evidence: 'VERIFIED' },
    { id: 'evidence-view', col: 3, row: 2, kind: 'output', title: 'Preuves, progression', lines: ['pages /evidence', 'et /progress'], evidence: 'VERIFIED' },
    { id: 'signals', col: 1, row: 3, kind: 'process', title: 'Signaux d’erreur', lines: ['regroupés en schémas', 'récurrents (ErrorPattern)'], evidence: 'VERIFIED' },
    { id: 'review', col: 2, row: 3, kind: 'process', title: 'Révision espacée', lines: ['items planifiés,', 'résultats enregistrés'], evidence: 'VERIFIED' },
    { id: 'review-view', col: 3, row: 3, kind: 'output', title: 'Vue révision', lines: ['page /review'], evidence: 'VERIFIED' },
  ],
  edges: [
    { from: 'sources', to: 'router', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'router', to: 'pdfjs', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'router', to: 'docling', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'router', to: 'refusal', kind: 'refusal', label: 'scan', evidence: 'VERIFIED' },
    { from: 'pdfjs', to: 'normalized', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'docling', to: 'normalized', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'normalized', to: 'cache', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'practice', to: 'evidence', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'evidence', to: 'competency', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'competency', to: 'evidence-view', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'practice', to: 'signals', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'signals', to: 'review', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'review', to: 'review-view', kind: 'flow', evidence: 'VERIFIED' },
  ],
  groups: [
    { id: 'extraction', title: 'Extraction documentaire locale', nodeIds: ['sources', 'router', 'pdfjs', 'normalized', 'refusal', 'docling', 'cache'] },
    { id: 'practice-lane', title: 'Pratique, preuves et révision · état persisté dans le navigateur', nodeIds: ['practice', 'evidence', 'competency', 'evidence-view', 'signals', 'review', 'review-view'] },
  ],
  stages: [
    { title: 'Extraction documentaire locale', nodeIds: ['sources', 'router', 'pdfjs', 'docling', 'refusal', 'normalized', 'cache'] },
    { title: 'Pratique, preuves et révision', nodeIds: ['practice', 'evidence', 'competency', 'evidence-view', 'signals', 'review', 'review-view'] },
  ],
  codeReferences: [
    { path: 'src/modules/document-extraction/core.ts', purpose: 'routage PDF.js / Docling / refus' },
    { path: 'src/modules/document-extraction/service.ts', purpose: 'extraction, cache, erreurs explicites' },
    { path: 'src/modules/document-extraction/local-process.ts', purpose: 'processus local borné (délai, taille, racines)' },
    { path: 'src/modules/learning-records/core.ts', purpose: 'EvidenceRecord et statuts de compétence' },
    { path: 'src/modules/review-engine/browser-store.ts', purpose: 'signaux, schémas, révision espacée' },
    { path: 'src/modules/academic-workspace/core.ts', purpose: 'contrôle d’ancrage des quiz et réponses' },
  ],
  inspectedAt: '2026-09-26',
  limits: [
    'Le schéma décrit la structure du code, pas un état d’exécution ni de déploiement.',
    'Aucun lien n’est tracé entre l’extraction documentaire et les modules de pratique : il n’a pas été observé.',
    'La couche de base de données (Prisma) n’est pas représentée : elle n’apparaît pas dans les modules lus.',
  ],
};
