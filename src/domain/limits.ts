/**
 * Product limits chosen for Brandfolio v1. These are design decisions of this
 * app, not industry standards; they are documented in the README.
 */
export const TEXT_LIMITS = {
  title: 80,
  subtitle: 180,
  longText: 4000,
  short: 120,
  listItem: 300,
  caption: 200,
  mockupText: 160,
} as const;

export const LIST_LIMITS = {
  values: 12,
  rules: 12,
  voicePairs: 8,
  logoDoDont: 8,
} as const;

export const PALETTE_LIMITS = { min: 2, max: 12 } as const;
export const IMAGERY_MAX_IMAGES = 6;
export const VOICE_QUALITIES = 3;

export const MIB = 1024 * 1024;

export const ASSET_LIMITS = {
  maxBytes: 5 * MIB,
  maxPixels: 20_000_000,
  svgMaxBytes: 1 * MIB,
  svgMaxElements: 5000,
  svgMaxDepth: 64,
} as const;

export const IMPORT_LIMITS = {
  maxArchiveBytes: 40 * MIB,
  maxUnpackedBytes: 100 * MIB,
  maxFiles: 100,
  maxProjectJsonBytes: 2 * MIB,
} as const;

export const HISTORY_LIMIT = 50;
export const AUTOSAVE_DEBOUNCE_MS = 600;
