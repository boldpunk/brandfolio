import { describe, expect, it } from 'vitest';
import { ENTITLEMENTS } from '@/cloud/contract';
import { createEmptyProject } from '@/domain/project';
import { lockedFeatures, pdfMarks, proFeaturesUsed } from './plan';

describe('plan rules', () => {
  it('marks free PDFs and adds a watermark only for Pro features', () => {
    const plain = createEmptyProject('X');
    expect(pdfMarks(plain, ENTITLEMENTS.free)).toEqual({ footer: true, watermark: false });
    expect(pdfMarks(plain, ENTITLEMENTS.pro)).toEqual({ footer: false, watermark: false });

    const premium = { ...plain, templateId: 'noir' as const };
    expect(proFeaturesUsed(premium)).toEqual(['premiumTemplate']);
    expect(pdfMarks(premium, ENTITLEMENTS.free)).toEqual({ footer: true, watermark: true });
    expect(lockedFeatures(premium, ENTITLEMENTS.pro)).toEqual([]);

    const fonts = { ...plain, brand: { ...plain.brand, customFonts: [{ id: 'f_1', name: 'Brand', category: 'sans' as const, files: [{ weight: 400, assetId: 'a' }] }] } };
    expect(lockedFeatures(fonts, ENTITLEMENTS.free)).toEqual(['customFonts']);
  });
});
