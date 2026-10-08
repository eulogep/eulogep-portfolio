/**
 * Visual evidence model.
 *
 * Every item is real project material: a capture of the running project, the verbatim output of a
 * real test run, or a verbatim code excerpt. `DECORATIVE` is a valid classification for review
 * documents, but it is deliberately absent from `ProofEvidenceType`, so decoration can never be
 * placed in an evidence slot: the type system refuses it.
 */

export type EvidenceType =
  | 'REAL_UI'
  | 'REAL_TEST_OUTPUT'
  | 'REAL_CODE_EVIDENCE'
  | 'REAL_ARCHITECTURE'
  | 'REAL_DATA_OUTPUT'
  | 'DOCUMENTATION'
  | 'DECORATIVE';

export type ProofEvidenceType = Exclude<EvidenceType, 'DECORATIVE'>;

/** Small factual labels only. Never "verified", "secure" or "production ready". */
export type EvidenceLabel = 'LIVE UI' | 'IMPLEMENTATION' | 'TEST' | 'VALIDATION' | 'ARCHITECTURE';

export type EvidencePlacement = 'interface' | 'execution';
export type ImageLayout = 'wide' | 'half' | 'narrow';

interface EvidenceBase {
  id: string;
  projectId: string;
  evidenceType: ProofEvidenceType;
  label: EvidenceLabel;
  /** What the item demonstrates, in factual terms. */
  caption: string;
  /** What a reader must know to read it correctly (synthetic data, missing services, ...). */
  context?: string;
  /** Where and how the material was captured. */
  source: string;
  placement: EvidencePlacement;
}

export interface EvidenceImageItem extends EvidenceBase {
  kind: 'image';
  /** Id of a file in `generated-assets.json`. */
  assetId: string;
  /** Describes what is visible. The caption says what it proves; the two must not repeat. */
  alt: string;
  layout: ImageLayout;
}

export interface EvidenceRun {
  command: string;
  captureId: string;
}

export interface EvidenceLogItem extends EvidenceBase {
  kind: 'log';
  runs: readonly EvidenceRun[];
  /** Plain statement of what was removed from the raw output, if anything. */
  redaction?: string;
}

export interface EvidenceCodeItem extends EvidenceBase {
  kind: 'code';
  /** Public repository path of the excerpt. */
  file: string;
  captureId: string;
}

export type EvidenceItem = EvidenceImageItem | EvidenceLogItem | EvidenceCodeItem;

export interface GeneratedAsset {
  id: string;
  project: string;
  name: string;
  width: number;
  height: number;
  widths: number[];
}

export interface CapturedText {
  lines: string[];
  first_line?: number;
  dropped_lines: number;
}
