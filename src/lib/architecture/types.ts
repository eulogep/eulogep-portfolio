/**
 * Architecture diagram specification.
 *
 * A spec is public-safe *architecture evidence*: every node and edge was observed in
 * public repository code. Relations that were only plausible are omitted, so the type
 * deliberately has no `INFERRED` level: an inferred relation cannot be expressed.
 */

/** VERIFIED: observed directly in code. CORROBORATED: observed on part of the code base only. */
export type EvidenceLevel = 'VERIFIED' | 'CORROBORATED';

export type NodeKind = 'input' | 'process' | 'store' | 'validation' | 'output';
export type EdgeKind = 'flow' | 'fallback' | 'refusal';

export interface DiagramNode {
  id: string;
  /** Zero-based grid position. Columns run left to right, rows top to bottom. */
  col: number;
  row: number;
  kind: NodeKind;
  title: string;
  /** At most two short lines, drawn under the title. */
  lines: readonly string[];
  /** Dashed border: the component may be absent or degrade without stopping the flow. */
  optional?: boolean;
  evidence: EvidenceLevel;
  /** Mobile/text-only remark that does not fit in the node. */
  note?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Short word only (it must fit in a 44px gutter): e.g. "repli". */
  label?: string;
  evidence: EvidenceLevel;
}

export interface DiagramGroup {
  id: string;
  title: string;
  nodeIds: readonly string[];
  /** `boundary` draws a stronger outline, used for security boundaries such as RLS. */
  variant?: 'lane' | 'boundary';
  /** Where the title sits on the top edge. Move it when a vertical edge would cross it. */
  titleAlign?: 'start' | 'center' | 'end';
}

export interface DiagramStage {
  title: string;
  nodeIds: readonly string[];
  /** `fallback`: the nodes are alternatives tried in order, not steps that all run. */
  sequence?: 'fallback';
}

export interface CodeReference {
  path: string;
  purpose: string;
}

export interface ArchitectureSpec {
  projectId: string;
  /** Accessible name of the figure. */
  title: string;
  /** Accessible summary read by assistive technology (svg <desc>). */
  summary: string;
  /** Ordered plain-language reading of the diagram: the text alternative. */
  narrative: readonly string[];
  cols: number;
  rows: number;
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
  groups: readonly DiagramGroup[];
  /** Ordered stages used by the stacked (small screen) rendering. */
  stages: readonly DiagramStage[];
  /** Public files the diagram was drawn from. Shown as plain text, never as raw evidence IDs. */
  codeReferences: readonly CodeReference[];
  /** ISO date of the code inspection the diagram reflects. */
  inspectedAt: string;
  /** Explicit boundaries of what the diagram does not show. */
  limits: readonly string[];
}
