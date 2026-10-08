import type { ArchitectureSpec, DiagramEdge, DiagramGroup, DiagramNode } from './types';

export const NODE_W = 188;
export const NODE_H = 84;
export const COL_GAP = 44;
export const ROW_GAP = 76;
export const PAD_X = 20;
export const PAD_TOP = 44;
export const PAD_BOTTOM = 22;
/** Widest a diagram is ever drawn, whatever the viewport. */
export const MAX_DIAGRAM_WIDTH = 1120;
export const GROUP_PAD = 14;
export const GROUP_TITLE_H = 30;
/** Conservative width of one character of a group title at its rendered size. */
export const GROUP_TITLE_CHAR_W = 7;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedNode extends DiagramNode, Rect {}

export interface PlacedEdge extends DiagramEdge {
  path: string;
  labelX: number;
  labelY: number;
}

export interface PlacedGroup extends DiagramGroup, Rect {}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  groups: PlacedGroup[];
}

export function canvasSize(cols: number, rows: number): { width: number; height: number } {
  return {
    width: PAD_X * 2 + cols * NODE_W + (cols - 1) * COL_GAP,
    height: PAD_TOP + rows * NODE_H + (rows - 1) * ROW_GAP + PAD_BOTTOM,
  };
}

export function placeNode(node: DiagramNode): PlacedNode {
  return {
    ...node,
    x: PAD_X + node.col * (NODE_W + COL_GAP),
    y: PAD_TOP + node.row * (NODE_H + ROW_GAP),
    width: NODE_W,
    height: NODE_H,
  };
}

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Edges are orthogonal and only join *adjacent* grid cells, so a line can never pass
 * through a third node. `validateSpec` enforces the adjacency this function assumes.
 */
export function placeEdge(edge: DiagramEdge, from: PlacedNode, to: PlacedNode): PlacedEdge {
  const midFromY = from.y + from.height / 2;
  const midToY = to.y + to.height / 2;

  if (from.row === to.row) {
    const forward = to.col > from.col;
    const x1 = forward ? from.x + from.width : from.x;
    const x2 = forward ? to.x : to.x + to.width;
    return {
      ...edge,
      path: `M${round(x1)} ${round(midFromY)}H${round(x2)}`,
      labelX: round((x1 + x2) / 2),
      labelY: round(midFromY - 8),
    };
  }

  if (from.col === to.col) {
    const down = to.row > from.row;
    const y1 = down ? from.y + from.height : from.y;
    const y2 = down ? to.y : to.y + to.height;
    const x = from.x + from.width / 2;
    return {
      ...edge,
      path: `M${round(x)} ${round(y1)}V${round(y2)}`,
      labelX: round(x + 8),
      labelY: round((y1 + y2) / 2 + 4),
    };
  }

  const x1 = from.x + from.width;
  const x2 = to.x;
  const xMid = (x1 + x2) / 2;
  return {
    ...edge,
    path: `M${round(x1)} ${round(midFromY)}H${round(xMid)}V${round(midToY)}H${round(x2)}`,
    labelX: round(xMid + 6),
    labelY: round((midFromY + midToY) / 2 + 4),
  };
}

export function placeGroup(group: DiagramGroup, nodes: ReadonlyMap<string, PlacedNode>): PlacedGroup {
  const members = group.nodeIds.map((id) => {
    const node = nodes.get(id);
    if (!node) throw new Error(`Group ${group.id} references unknown node ${id}.`);
    return node;
  });
  const left = Math.min(...members.map((node) => node.x)) - GROUP_PAD;
  const top = Math.min(...members.map((node) => node.y)) - GROUP_TITLE_H;
  const right = Math.max(...members.map((node) => node.x + node.width)) + GROUP_PAD;
  const bottom = Math.max(...members.map((node) => node.y + node.height)) + GROUP_PAD;
  return { ...group, x: left, y: top, width: right - left, height: bottom - top };
}

export function layoutDiagram(spec: ArchitectureSpec): DiagramLayout {
  const { width, height } = canvasSize(spec.cols, spec.rows);
  const nodes = spec.nodes.map(placeNode);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = spec.edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) throw new Error(`Edge ${edge.from} -> ${edge.to} references an unknown node.`);
    return placeEdge(edge, from, to);
  });
  const groups = spec.groups.map((group) => placeGroup(group, byId));
  return { width, height, nodes, edges, groups };
}

/** Horizontal extent of a group title, given where it is anchored. */
export function groupTitleSpan(group: PlacedGroup): { x0: number; x1: number } {
  const textWidth = group.title.length * GROUP_TITLE_CHAR_W;
  const align = group.titleAlign ?? 'start';
  if (align === 'center') return { x0: group.x + (group.width - textWidth) / 2, x1: group.x + (group.width + textWidth) / 2 };
  if (align === 'end') return { x0: group.x + group.width - 14 - textWidth, x1: group.x + group.width - 14 };
  return { x0: group.x + 14, x1: group.x + 14 + textWidth };
}

/** Vertical stretches of an edge path as [x, yFrom, yTo]. Paths only use M, H and V. */
export function verticalSegments(path: string): Array<[number, number, number]> {
  const segments: Array<[number, number, number]> = [];
  let x = 0;
  let y = 0;
  for (const [, command, first, second] of path.matchAll(/([MHV])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
    if (command === 'M') {
      x = Number(first);
      y = Number(second);
    } else if (command === 'H') {
      x = Number(first);
    } else {
      segments.push([x, y, Number(first)]);
      y = Number(first);
    }
  }
  return segments;
}

const NODE_ID = /^[a-z][a-z0-9-]*$/;
const MAX_LINES = 2;
const MAX_TITLE = 22;
const MAX_LINE = 27;
const MAX_EDGE_LABEL = 6;

/** Returns every problem found; an empty array means the spec is renderable and honest. */
export function validateSpec(spec: ArchitectureSpec): string[] {
  const problems: string[] = [];
  const byId = new Map<string, DiagramNode>();

  for (const node of spec.nodes) {
    if (!NODE_ID.test(node.id)) problems.push(`Node id "${node.id}" is not kebab-case.`);
    if (byId.has(node.id)) problems.push(`Duplicate node id "${node.id}".`);
    byId.set(node.id, node);
    if (node.col < 0 || node.col >= spec.cols || node.row < 0 || node.row >= spec.rows) {
      problems.push(`Node "${node.id}" is outside the ${spec.cols}x${spec.rows} grid.`);
    }
    if (node.title.length > MAX_TITLE) problems.push(`Node "${node.id}" title exceeds ${MAX_TITLE} characters.`);
    if (node.lines.length > MAX_LINES) problems.push(`Node "${node.id}" has more than ${MAX_LINES} lines.`);
    for (const line of node.lines) {
      if (line.length > MAX_LINE) problems.push(`Node "${node.id}" line "${line}" exceeds ${MAX_LINE} characters.`);
    }
  }

  const cells = new Set<string>();
  for (const node of spec.nodes) {
    const cell = `${node.col}:${node.row}`;
    if (cells.has(cell)) problems.push(`Two nodes share grid cell ${cell}.`);
    cells.add(cell);
  }

  for (const edge of spec.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      problems.push(`Edge ${edge.from} -> ${edge.to} references an unknown node.`);
      continue;
    }
    if (edge.label && edge.label.length > MAX_EDGE_LABEL) {
      problems.push(`Edge ${edge.from} -> ${edge.to} label exceeds ${MAX_EDGE_LABEL} characters.`);
    }
    if (edge.kind === 'fallback' && !edge.label) problems.push(`Fallback edge ${edge.from} -> ${edge.to} needs a label.`);

    const sameRow = from.row === to.row;
    const sameCol = from.col === to.col;
    if (sameRow && Math.abs(from.col - to.col) !== 1) problems.push(`Edge ${edge.from} -> ${edge.to} skips a column.`);
    if (sameCol && Math.abs(from.row - to.row) !== 1) problems.push(`Edge ${edge.from} -> ${edge.to} skips a row.`);
    if (!sameRow && !sameCol && to.col - from.col !== 1) {
      problems.push(`Elbow edge ${edge.from} -> ${edge.to} must go to the next column.`);
    }
  }

  const placed = new Map(spec.nodes.map((node) => [node.id, placeNode(node)]));
  for (const group of spec.groups) {
    const unknown = group.nodeIds.filter((id) => !byId.has(id));
    for (const id of unknown) problems.push(`Group ${group.id} references unknown node ${id}.`);
    if (unknown.length > 0) continue;
    // The title is drawn on one line inside the group's top margin: it must fit its box.
    const box = placeGroup(group, placed);
    if (group.title.length * GROUP_TITLE_CHAR_W > box.width - 24) {
      problems.push(`Group "${group.id}" title is too long for its ${Math.round(box.width)}px box.`);
    }
  }

  const staged = spec.stages.flatMap((stage) => stage.nodeIds);
  for (const id of staged) if (!byId.has(id)) problems.push(`Stage references unknown node ${id}.`);
  for (const id of byId.keys()) {
    const count = staged.filter((candidate) => candidate === id).length;
    if (count !== 1) problems.push(`Node "${id}" must appear in exactly one stage (found ${count}).`);
  }

  if (problems.length === 0) {
    // A line drawn through a group title makes the title unreadable: refuse the layout.
    const layout = layoutDiagram(spec);
    for (const group of layout.groups) {
      const { x0, x1 } = groupTitleSpan(group);
      const bandTop = group.y;
      const bandBottom = group.y + GROUP_TITLE_H;
      for (const edge of layout.edges) {
        for (const [x, yFrom, yTo] of verticalSegments(edge.path)) {
          const crossesBand = Math.max(Math.min(yFrom, yTo), bandTop) < Math.min(Math.max(yFrom, yTo), bandBottom);
          if (crossesBand && x >= x0 - 6 && x <= x1 + 6) {
            problems.push(`Edge ${edge.from} -> ${edge.to} crosses the title of group "${group.id}".`);
          }
        }
      }
    }
  }

  if (spec.narrative.length === 0) problems.push('The diagram needs a text alternative (narrative).');
  if (spec.codeReferences.length === 0) problems.push('The diagram needs at least one public code reference.');
  return problems;
}
