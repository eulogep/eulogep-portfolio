import { getEvidenceAsset, getEvidenceFor, isImageItem } from '../data/visual-evidence';
import { isProjectDetailEligible, type PublicProject } from './page-models';

export type CarouselItem = PublicProject & { demoUrl?: string };

/** Presentation adapter: project facts remain in the approved public view. */
export function carouselProject(project: CarouselItem) {
  const capture = getEvidenceFor(project.project_id, 'interface').find(isImageItem);
  const asset = capture ? getEvidenceAsset(capture.assetId) : undefined;
  const image = asset ? {
    src: `/evidence/${asset.project}/${asset.name}-640.avif`,
    width: asset.width,
    height: asset.height,
    label: 'Capture du projet',
  } : project.project_id === 'project-manga-wave' ? {
    src: '/media/manga-wave-presentation-poster.webp',
    width: 1280,
    height: 720,
    label: 'Présentation vidéo',
  } : undefined;
  const tone = project.project_id === 'project-manga-wave' ? 'rose'
    : project.technologies.some((tech) => /python/i.test(tech)) ? 'violet'
    : project.technologies.some((tech) => /supabase/i.test(tech)) ? 'mint' : 'cyan';
  return {
    ...project, image, tone,
    demoUrl: project.demoUrl?.startsWith('https://') ? project.demoUrl : undefined,
    detailUrl: isProjectDetailEligible(project) ? `/projects/${project.slug}/` : undefined,
  };
}
