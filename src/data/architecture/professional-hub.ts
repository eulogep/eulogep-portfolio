import type { ArchitectureSpec } from '../../lib/architecture/types';

/*
 * Drawn from the public Projet-hub-administratif repository, inspected 2026-09-26.
 * Deliberately absent: the names of domain modules that would expose non-public
 * activities, so only organisations, projets, tâches and documents are named, and the
 * list is marked as partial. Row Level Security was read in the identity/workspace and
 * documents migrations; the other domain tables were not read policy by policy.
 */
export const professionalHubArchitecture: ArchitectureSpec = {
  projectId: 'project-professional-hub',
  title: 'Architecture de Professional Hub',
  summary:
    'Une application Next.js authentifiée par Supabase, où chaque table de données appartient à un workspace protégé par Row Level Security, avec un flux de téléversement de documents vérifié vers Cloudflare R2 — S3-compatible object storage.',
  narrative: [
    'Entrée : l’utilisateur agit depuis le navigateur ; le proxy Next.js rafraîchit la session Supabase à chaque requête.',
    'Contrôle d’accès : sans session valide, la garde d’accès redirige vers la page de connexion.',
    'Traitement : les modules métier (dont organisations, projets, tâches et documents) s’exécutent côté serveur avec la session de l’utilisateur.',
    'Stockage et frontière : les données vivent dans Supabase Postgres, où chaque ligne appartient à un workspace personnel et où les politiques Row Level Security limitent l’accès au propriétaire. Des tests d’isolation entre utilisateurs existent dans le dépôt.',
    'Téléversement de documents : le navigateur ouvre une session d’upload créée côté serveur ; le serveur signe chaque opération multipart ; le fichier part directement vers Cloudflare R2 — S3-compatible object storage.',
    'Validation : à la finalisation, le serveur vérifie la taille, la signature réelle du fichier (PDF, PNG ou JPEG) et calcule un SHA-256, puis enregistre la version en base. Un échec supprime l’objet orphelin.',
  ],
  cols: 4,
  rows: 2,
  nodes: [
    { id: 'browser', col: 0, row: 0, kind: 'input', title: 'Navigateur', lines: ['interface React,', 'envoi de fichiers via Uppy'], evidence: 'VERIFIED' },
    { id: 'proxy', col: 1, row: 0, kind: 'validation', title: 'Proxy et garde', lines: ['session Supabase à jour ;', 'sans session : /login'], evidence: 'VERIFIED' },
    { id: 'modules', col: 2, row: 0, kind: 'process', title: 'Modules métier', lines: ['organisations, projets,', 'tâches, documents…'], evidence: 'VERIFIED' },
    { id: 'postgres', col: 3, row: 0, kind: 'store', title: 'Supabase Postgres', lines: ['un workspace personnel', 'par utilisateur'], evidence: 'CORROBORATED' },
    { id: 'session', col: 0, row: 1, kind: 'process', title: 'Session d’upload', lines: ['créée côté serveur,', 'état suivi en base'], evidence: 'VERIFIED' },
    { id: 'signing', col: 1, row: 1, kind: 'validation', title: 'Signature serveur', lines: ['URL présignées, session', 'du propriétaire exigée'], evidence: 'VERIFIED' },
    { id: 'objects', col: 2, row: 1, kind: 'store', title: 'Cloudflare R2', lines: ['S3-compatible object', 'storage ; envoi direct'], evidence: 'VERIFIED' },
    { id: 'finalize', col: 3, row: 1, kind: 'validation', title: 'Finalisation', lines: ['taille, signature réelle', 'du fichier, SHA-256'], evidence: 'VERIFIED' },
  ],
  edges: [
    { from: 'browser', to: 'proxy', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'proxy', to: 'modules', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'modules', to: 'postgres', kind: 'flow', evidence: 'CORROBORATED' },
    { from: 'browser', to: 'session', kind: 'flow', label: 'Uppy', evidence: 'VERIFIED' },
    { from: 'session', to: 'signing', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'signing', to: 'objects', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'objects', to: 'finalize', kind: 'flow', evidence: 'VERIFIED' },
    { from: 'finalize', to: 'postgres', kind: 'flow', label: 'RPC', evidence: 'VERIFIED' },
  ],
  groups: [
    { id: 'app', title: 'Application Next.js · serveur', nodeIds: ['proxy', 'modules'] },
    { id: 'rls', title: 'Frontière RLS', nodeIds: ['postgres'], variant: 'boundary' },
    { id: 'upload', title: 'Documents privés · téléversement vérifié', nodeIds: ['session', 'signing', 'objects', 'finalize'], titleAlign: 'center' },
  ],
  stages: [
    { title: 'Accès et données', nodeIds: ['browser', 'proxy', 'modules', 'postgres'] },
    { title: 'Téléversement de documents', nodeIds: ['session', 'signing', 'objects', 'finalize'] },
  ],
  codeReferences: [
    { path: 'proxy.ts, src/lib/auth/require-user.ts', purpose: 'session et garde d’accès' },
    { path: 'supabase/migrations/*_identity_workspace_rls.sql', purpose: 'politiques RLS par workspace' },
    { path: 'tests/rls/workspace-isolation.test.ts', purpose: 'isolation entre utilisateurs' },
    { path: 'src/modules/documents/services/upload-signing.service.ts', purpose: 'signature des opérations d’upload' },
    { path: 'src/modules/documents/services/document-finalization.service.ts', purpose: 'taille, signature, SHA-256, RPC' },
    { path: 'src/integrations/storage/r2/provider.ts', purpose: 'fournisseur Cloudflare R2' },
  ],
  inspectedAt: '2026-09-26',
  limits: [
    'Le schéma décrit la structure du code, pas un état d’exécution ni de déploiement.',
    'Les politiques RLS ont été lues pour les profils, workspaces, organisations et documents ; les autres tables du domaine ne sont pas détaillées.',
    'La liste des modules métier est volontairement partielle.',
  ],
};
