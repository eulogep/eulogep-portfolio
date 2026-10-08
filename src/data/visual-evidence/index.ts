import type { CapturedText, EvidenceImageItem, EvidenceItem, EvidencePlacement, GeneratedAsset } from '../../lib/visual-evidence/types';

import capturedLogs from './captured-logs.json';
import generatedAssets from './generated-assets.json';
import { evidenceItems } from './items';

const assets = new Map<string, GeneratedAsset>((generatedAssets.assets as GeneratedAsset[]).map((asset) => [asset.id, asset]));
const captures = capturedLogs.captures as Record<string, CapturedText>;

export function getEvidenceAsset(assetId: string): GeneratedAsset {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Unknown evidence asset "${assetId}".`);
  return asset;
}

export function getCapturedText(captureId: string): CapturedText {
  const capture = captures[captureId];
  if (!capture) throw new Error(`Unknown captured text "${captureId}".`);
  return capture;
}

export function getEvidenceFor(projectId: string, placement: EvidencePlacement): EvidenceItem[] {
  return evidenceItems.filter((item) => item.projectId === projectId && item.placement === placement);
}

export function isImageItem(item: EvidenceItem): item is EvidenceImageItem {
  return item.kind === 'image';
}

export { evidenceItems };
export const allAssets: readonly GeneratedAsset[] = [...assets.values()];
export const allCaptures: Readonly<Record<string, CapturedText>> = captures;
