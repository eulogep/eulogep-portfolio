import type { DiagramEdge, DiagramNode, NodeKind } from './types';

/** Kind is always carried by a text tag, so it never depends on colour alone. */
export const kindLabels: Readonly<Record<NodeKind, string>> = {
  input: 'ENTRÉE',
  process: 'TRAITEMENT',
  store: 'STOCKAGE',
  validation: 'VALIDATION',
  output: 'SORTIE',
};

export const kindMeaning: Readonly<Record<NodeKind, string>> = {
  input: 'ce qui entre dans le système',
  process: 'traitement des données',
  store: 'ce qui est conservé',
  validation: 'contrôle ou frontière',
  output: 'ce qui en sort',
};

export function nodeTag(node: Pick<DiagramNode, 'kind' | 'optional'>): string {
  return node.optional ? 'OPTIONNEL' : kindLabels[node.kind];
}

export function isPartial(node: Pick<DiagramNode, 'evidence'>): boolean {
  return node.evidence === 'CORROBORATED';
}

export function usedKinds(nodes: readonly DiagramNode[]): NodeKind[] {
  const order: NodeKind[] = ['input', 'process', 'store', 'validation', 'output'];
  return order.filter((kind) => nodes.some((node) => node.kind === kind));
}

export function usesEdgeKind(edges: readonly DiagramEdge[], kind: DiagramEdge['kind']): boolean {
  return edges.some((edge) => edge.kind === kind);
}
