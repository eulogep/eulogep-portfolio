import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const approvedCvAsset = {
  href: '/cv/euloge-mabiala-cv.pdf',
  filename: 'euloge-mabiala-cv.pdf',
  language: 'fr',
  format: 'PDF',
} as const;

const approvedCvPath = fileURLToPath(new URL('../../public/cv/euloge-mabiala-cv.pdf', import.meta.url));

export function hasApprovedCvAsset(): boolean {
  return existsSync(approvedCvPath);
}
