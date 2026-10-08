import type { ArchitectureSpec } from '../../lib/architecture/types';

/*
 * Drawn from the public Corrector-ai repository (backend/*), inspected 2026-09-26.
 * Two provider chains exist and they differ:
 *   grading (backend/services/llm.py):        Claude -> DeepSeek -> Gemini, sequential
 *   OCR (backend/services/vision.py):         Gemini -> Claude Vision, sequential
 *   rubric (backend/services/subject_parser): Claude -> DeepSeek, sequential
 * Providers are only tried when their API key is configured. Nothing is orchestrated in
 * parallel. The optional Redis cache for validated rubrics is noted in the narrative only.
 */
export const correctorAiArchitecture: ArchitectureSpec = {
  projectId: 'project-corrector-ai',
  title: 'Architecture de Corrector AI',
  summary:
    'Un sujet d’examen devient un barème validé, une copie manuscrite devient un texte structuré validé, puis un contrôle de cohérence précède une correction par fournisseurs IA en repli séquentiel, enregistrée en attente de relecture par le professeur.',
  narrative: [
    'Entrées : un sujet d’examen (PDF) et une copie manuscrite (image ou PDF).',
    'Sujet : le texte est extrait par Docling, puis PyMuPDF, puis Gemini Vision, chaque méthode n’étant tentée que si la précédente échoue ; un fournisseur (Claude, avec repli DeepSeek) en tire un barème structuré et validé, éventuellement mis en cache dans Redis.',
    'Copie : un OCR multimodal (Gemini, avec repli Claude Vision) produit un JSON validé par un contrat strict ; une sortie non conforme provoque une erreur explicite.',
    'Contrôle : avant tout appel de correction, le total des points du barème doit égaler la note demandée et les numéros d’exercice doivent être uniques.',
    'Correction : Claude est essayé en premier, puis DeepSeek, puis Gemini, en repli séquentiel avec réessais à délai croissant. Chaque appel est mesuré (métriques Prometheus) et sa réponse est validée contre le barème.',
    'Sortie : la correction validée est enregistrée avec le fournisseur utilisé et un statut en attente de relecture ; aucun fournisseur disponible produit une erreur explicite, jamais une note simulée. Le professeur approuve ou demande une révision.',
  ],
  cols: 5,
  rows: 3,
  nodes: [
    { id: 'subject', col: 0, row: 0, kind: 'input', title: 'Sujet d’examen', lines: ['PDF'], evidence: 'VERIFIED' },
    { id: 'subject-extraction', col: 1, row: 0, kind: 'process', title: 'Extraction du sujet', lines: ['Docling → PyMuPDF →', 'Gemini Vision (repli)'], evidence: 'VERIFIED' },
    { id: 'rubric', col: 2, row: 0, kind: 'validation', title: 'Barème structuré', lines: ['Claude, repli DeepSeek ;', 'sortie validée'], evidence: 'VERIFIED' },
    { id: 'sheet', col: 0, row: 2, kind: 'input', title: 'Copie manuscrite', lines: ['image ou PDF'], evidence: 'VERIFIED' },
    { id: 'ocr', col: 1, row: 2, kind: 'process', title: 'OCR multimodal', lines: ['Gemini, repli', 'Claude Vision'], evidence: 'VERIFIED' },
    { id: 'ocr-valid', col: 2, row: 2, kind: 'validation', title: 'Sortie OCR validée', lines: ['contrat JSON strict, sinon', 'erreur explicite'], evidence: 'VERIFIED' },
    { id: 'scale-check', col: 2, row: 1, kind: 'validation', title: 'Contrôle du barème', lines: ['total des points = note ;', 'exercices uniques'], evidence: 'VERIFIED' },
    { id: 'claude', col: 3, row: 0, kind: 'process', title: 'Claude', lines: ['premier fournisseur', 'de correction'], evidence: 'VERIFIED' },
    { id: 'deepseek', col: 3, row: 1, kind: 'process', title: 'DeepSeek', lines: ['deuxième fournisseur', 'si le premier échoue'], optional: true, evidence: 'VERIFIED' },
    { id: 'gemini', col: 3, row: 2, kind: 'process', title: 'Gemini', lines: ['troisième fournisseur', 'si les deux échouent'], optional: true, evidence: 'VERIFIED' },
    { id: 'graded', col: 4, row: 1, kind: 'output', title: 'Correction validée', lines: ['notes et feedback ; jamais', 'une note simulée'], evidence: 'VERIFIED' },
    { id: 'review', col: 4, row: 2, kind: 'output', title: 'Relecture professeur', lines: ['statut en attente ;', 'approuver ou réviser'], evidence: 'VERIFIED' },
  ],
  edges: [
    { from: 'subject', to: 'subject-extraction', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'subject-extraction', to: 'rubric', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'rubric', to: 'scale-check', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'sheet', to: 'ocr', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'ocr', to: 'ocr-valid', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'ocr-valid', to: 'scale-check', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'scale-check', to: 'claude', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'claude', to: 'deepseek', kind: 'fallback', label: 'repli', evidence: 'VERIFIED' },
    { from: 'deepseek', to: 'gemini', kind: 'fallback', label: 'repli', evidence: 'VERIFIED' },
    { from: 'claude', to: 'graded', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'deepseek', to: 'graded', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'gemini', to: 'graded', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'graded', to: 'review', kind: 'flow', evidence: 'VERIFIED' },
  ],
  groups: [
    { id: 'providers', title: 'Repli séquentiel', nodeIds: ['claude', 'deepseek', 'gemini'] },
  ],
  stages: [
    { title: 'Sujet et barème', nodeIds: ['subject', 'subject-extraction', 'rubric'] },
    { title: 'Copie et OCR', nodeIds: ['sheet', 'ocr', 'ocr-valid'] },
    { title: 'Contrôle avant correction', nodeIds: ['scale-check'] },
    { title: 'Correction : fournisseurs essayés dans l’ordre', nodeIds: ['claude', 'deepseek', 'gemini'], sequence: 'fallback' },
    { title: 'Sortie', nodeIds: ['graded', 'review'] },
  ],
  codeReferences: [
    { path: 'backend/services/llm.py', purpose: 'chaîne de correction, contrôle du barème, erreurs explicites' },
    { path: 'backend/services/vision.py', purpose: 'OCR Gemini puis Claude Vision' },
    { path: 'backend/services/subject_parser.py', purpose: 'extraction du sujet et génération du barème' },
    { path: 'backend/schemas/ai_outputs.py', purpose: 'contrats de sortie validés' },
    { path: 'backend/routes/grading.py', purpose: 'correction enregistrée et relecture' },
    { path: 'backend/services/observability.py', purpose: 'métriques des appels IA' },
  ],
  inspectedAt: '2026-09-26',
  limits: [
    'Le schéma décrit la structure du code, pas un état d’exécution ni de déploiement.',
    'Un fournisseur n’est essayé que si sa clé d’API est configurée ; le schéma montre la chaîne maximale.',
    'La qualité pédagogique des corrections n’est pas évaluée ici.',
  ],
};
