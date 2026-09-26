/**
 * What the current plan means for a project. Local work never needs an
 * account; Pro features (premium templates, brand fonts) can be tried by
 * everyone, and the free plan marks the exported PDF instead of blocking it.
 */
import { useAccount } from '@/cloud/account';
import { ENTITLEMENTS, type Entitlements, type Plan } from '@/cloud/contract';
import type { Project } from '@/domain/schema';
import type { PdfMarks } from '@/templates/pdf/BrandbookPdf';
import { isPremiumTemplate } from '@/templates/templateInfo';

export type ProFeature = 'premiumTemplate' | 'customFonts';

/** Pro features this project uses. */
export function proFeaturesUsed(project: Pick<Project, 'templateId' | 'brand'>): ProFeature[] {
  const used: ProFeature[] = [];
  if (isPremiumTemplate(project.templateId)) used.push('premiumTemplate');
  if (project.brand.customFonts.length > 0) used.push('customFonts');
  return used;
}

/** Pro features used that the plan does not include. */
export function lockedFeatures(project: Pick<Project, 'templateId' | 'brand'>, entitlements: Entitlements): ProFeature[] {
  return proFeaturesUsed(project).filter((f) => (f === 'premiumTemplate' ? !entitlements.premiumTemplates : !entitlements.customFonts));
}

export function pdfMarks(project: Pick<Project, 'templateId' | 'brand'>, entitlements: Entitlements): PdfMarks {
  return { footer: entitlements.pdfFooter, watermark: lockedFeatures(project, entitlements).length > 0 };
}

/** The signed-in user's plan; free when signed out or without the API. */
export function usePlan(): { plan: Plan; entitlements: Entitlements; signedIn: boolean } {
  const account = useAccount();
  if (account.status === 'signedIn') return { plan: account.me.plan, entitlements: account.me.entitlements, signedIn: true };
  return { plan: 'free', entitlements: ENTITLEMENTS.free, signedIn: false };
}
