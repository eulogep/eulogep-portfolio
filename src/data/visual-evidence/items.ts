import type { EvidenceItem } from '../../lib/visual-evidence/types';

/*
 * Real project material only, reviewed for privacy on 2026-09-26. See
 * docs/review/project-visual-evidence-v1/manifest.json for provenance and redaction records.
 *
 * ELOS material comes from the committed local state 82a1803, which is ahead of the public
 * repository. Hub and Corrector AI material comes from their public commits.
 */

const ELOS_UI_SOURCE = 'Capture locale, build de production du commit 82a1803 (pas encore publié sur le dépôt public)';
const ELOS_RUN_SOURCE = 'Exécution locale le 26/09/2026 · Node v26.8.1 · commit 82a1803 (pas encore publié sur le dépôt public)';
const HUB_UI_SOURCE = 'Capture locale, commit public 002694e, base Supabase locale et comptes de démonstration';
const HUB_RUN_SOURCE = 'Exécution locale le 26/09/2026 · Node v26.8.1 · Supabase local · commit public 002694e';
const CORRECTOR_UI_SOURCE = 'Capture locale, commit public 7a36e86, exemple synthétique, aucun fournisseur IA configuré';
const CORRECTOR_RUN_SOURCE = 'Exécution locale le 26/09/2026 · Python 3.14.7 · pytest 8.3.0 · commit public 7a36e86';

const NODE_WARNING_REDACTION =
  'Retiré : les avertissements Node qui contiennent des chemins de fichiers locaux. Aucune ligne de résultat n’est modifiée.';

export const evidenceItems: readonly EvidenceItem[] = [
  // ------------------------------------------------------------- Engineer Learning OS
  {
    kind: 'image',
    id: 'elos-extraction-comparison',
    projectId: 'project-elos',
    evidenceType: 'REAL_UI',
    label: 'LIVE UI',
    placement: 'interface',
    layout: 'wide',
    assetId: 'elos--extraction-comparison',
    alt: 'Page d’Engineer Learning OS pour un chapitre de cours PDF : détail de l’extraction (type de PDF, pages ingérées, méthode PDF.js), limites visibles, et tableau comparant PDF.js et Docling sur quatre pages pilotes.',
    caption:
      'Comparaison d’extraction PDF.js et Docling sur quatre pages pilotes, avec les limites déclarées par l’application : aucun OCR exécuté, peu de texte extractible en page 17, disposition spatiale partiellement perdue en page 20.',
    context:
      'Les valeurs affichées sont des métriques pilotes dérivées, pas le résultat d’une extraction lancée pendant la capture.',
    source: ELOS_UI_SOURCE,
  },
  {
    kind: 'image',
    id: 'elos-evidence-record',
    projectId: 'project-elos',
    evidenceType: 'REAL_UI',
    label: 'LIVE UI',
    placement: 'interface',
    layout: 'wide',
    assetId: 'elos--evidence-record',
    alt: 'Page Preuves d’Engineer Learning OS : un enregistrement « Situation professionnelle traitée » listant cinq critères validés, un état plafonné à Pratiquée, l’aide déclarée « IA externe » et un avertissement sur l’autonomie.',
    caption:
      'Enregistrement de preuve créé à la fin d’un scénario guidé : cinq critères validés, état plafonné à « Pratiquée », et aide « IA externe » déclarée, que l’application exclut de la preuve d’autonomie.',
    context:
      'Données d’exemple synthétiques (TRAINING_SYNTHETIC). Les réponses ont été saisies pour cette capture avec l’aide déclarée « IA externe » : elles ne représentent pas un acquis autonome.',
    source: ELOS_UI_SOURCE,
  },
  {
    kind: 'log',
    id: 'elos-test-output',
    projectId: 'project-elos',
    evidenceType: 'REAL_TEST_OUTPUT',
    label: 'TEST',
    placement: 'execution',
    caption:
      'Résultat de deux suites : statut de compétence dérivé des preuves (un échec isolé n’efface pas une preuve plus forte), puis routage d’extraction, refus des PDF scannés et invalidation du cache.',
    context: 'Deux suites parmi celles du projet, exécutées séparément ; ce n’est pas un total de tests.',
    source: ELOS_RUN_SOURCE,
    redaction: NODE_WARNING_REDACTION,
    runs: [
      {
        command:
          'node --test --experimental-strip-types --loader ./tests/unit/learning-history/node-loader.mjs tests/unit/learning-records/evidence-competency.test.ts',
        captureId: 'elos-evidence-competency',
      },
      {
        command:
          'node --test --experimental-strip-types --loader ./tests/unit/learning-history/node-loader.mjs tests/unit/document-extraction/document-extraction.test.ts',
        captureId: 'elos-document-extraction',
      },
    ],
  },

  // ------------------------------------------------------------------- Professional Hub
  {
    kind: 'image',
    id: 'hub-isolation-account-a',
    projectId: 'project-professional-hub',
    evidenceType: 'REAL_UI',
    label: 'VALIDATION',
    placement: 'interface',
    layout: 'narrow',
    assetId: 'hub--isolation-account-a',
    alt: 'Page Organisations de Professional Hub connectée au compte A : une organisation « Organisation de démonstration » est listée.',
    caption: 'Compte A, page Organisations : l’organisation de démonstration créée par ce compte est listée.',
    context: 'Organisation et comptes de démonstration créés pour cette capture.',
    source: HUB_UI_SOURCE,
  },
  {
    kind: 'image',
    id: 'hub-isolation-account-b',
    projectId: 'project-professional-hub',
    evidenceType: 'REAL_UI',
    label: 'VALIDATION',
    placement: 'interface',
    layout: 'narrow',
    assetId: 'hub--isolation-account-b',
    alt: 'Même page Organisations de Professional Hub connectée au compte B : l’état vide « Aucune organisation » est affiché.',
    caption:
      'Compte B, même page, même base : aucune organisation visible. La ligne du compte A n’est pas accessible à ce compte, ce que la suite de tests d’isolation Row Level Security vérifie aussi.',
    source: HUB_UI_SOURCE,
  },
  {
    kind: 'image',
    id: 'hub-upload-form',
    projectId: 'project-professional-hub',
    evidenceType: 'REAL_UI',
    label: 'LIVE UI',
    placement: 'interface',
    layout: 'narrow',
    assetId: 'hub--upload-form',
    alt: 'Formulaire « Nouveau document » de Professional Hub : nom, catégorie, statut, rattachements facultatifs, dates, notes et zone de dépôt de fichier limitée aux PDF, PNG ou JPEG.',
    caption:
      'Formulaire de nouveau document : le fichier reste privé et n’est disponible qu’après vérification serveur ; PDF, PNG ou JPEG, 500 MiB au maximum, envoi géré par Uppy.',
    context:
      'État avant envoi. Cloudflare R2 — S3-compatible object storage n’est pas connecté dans cette exécution locale : le cycle de vie complet d’un fichier n’est donc pas montré ici.',
    source: HUB_UI_SOURCE,
  },
  {
    kind: 'log',
    id: 'hub-test-output',
    projectId: 'project-professional-hub',
    evidenceType: 'REAL_TEST_OUTPUT',
    label: 'TEST',
    placement: 'execution',
    caption:
      'Résultat des tests d’isolation RLS entre deux utilisateurs et des tests d’intégration des documents (accès anonyme ou étranger refusé, finalisation atomique, immuable et idempotente).',
    context:
      'Exécutés contre une base Supabase locale ; l’URL et la clé de test locales ne sont pas affichées. Deux fichiers de tests, pas un total.',
    source: HUB_RUN_SOURCE,
    runs: [
      { command: 'node --test tests/rls/workspace-isolation.node.test.mjs', captureId: 'hub-rls' },
      { command: 'node --test tests/integration/documents.node.test.mjs', captureId: 'hub-documents' },
    ],
  },

  // ------------------------------------------------------------------------- Corrector AI
  {
    kind: 'image',
    id: 'corrector-answer-key-entry',
    projectId: 'project-corrector-ai',
    evidenceType: 'REAL_UI',
    label: 'LIVE UI',
    placement: 'interface',
    layout: 'wide',
    assetId: 'corrector--answer-key-entry',
    alt: 'Interface de Corrector AI à l’étape « Corrigé type » : deux exercices avec énoncé, réponse attendue, réponse de l’élève et points maximum, et un bouton « Lancer la correction ».',
    caption:
      'Étape « Corrigé type » : pour chaque exercice, l’énoncé, la réponse attendue, la réponse de l’élève et les points maximum sont saisis avant de lancer la correction.',
    context:
      'Exemple synthétique de deux exercices d’arithmétique saisi pour cette capture. Aucun fournisseur IA n’est configuré dans cette exécution : aucun résultat de correction n’est montré.',
    source: CORRECTOR_UI_SOURCE,
  },
  {
    kind: 'log',
    id: 'corrector-test-output',
    projectId: 'project-corrector-ai',
    evidenceType: 'REAL_TEST_OUTPUT',
    label: 'TEST',
    placement: 'execution',
    caption:
      'Suites de validation, de repli de fournisseurs et d’OCR : contrats de sortie stricts, repli séquentiel Claude puis DeepSeek puis Gemini, réessais à délai croissant, et erreur 503 explicite quand aucun fournisseur n’est configuré.',
    context: 'Trois fichiers de tests exécutés ensemble, sans clé de fournisseur configurée : aucun appel externe n’a été effectué.',
    source: CORRECTOR_RUN_SOURCE,
    redaction: 'Retiré : un avertissement de configuration de pytest-asyncio qui contient un chemin de fichier local.',
    runs: [
      {
        command: 'pytest backend/tests/test_ai_validation.py backend/tests/test_grading.py backend/tests/test_ocr.py -v',
        captureId: 'corrector-pytest',
      },
    ],
  },
  {
    kind: 'code',
    id: 'corrector-fallback-loop',
    projectId: 'project-corrector-ai',
    evidenceType: 'REAL_CODE_EVIDENCE',
    label: 'IMPLEMENTATION',
    placement: 'execution',
    caption:
      'Boucle de repli de grade_copy : chaque fournisseur configuré est essayé à son tour, sa réponse est validée contre le barème, et l’absence de réponse exploitable lève une erreur explicite. Les fournisseurs ne sont jamais appelés en parallèle.',
    source: 'Extrait de backend/services/llm.py, lignes 273 à 310, commit public 7a36e86',
    file: 'backend/services/llm.py',
    captureId: 'corrector-llm-loop',
  },
];
