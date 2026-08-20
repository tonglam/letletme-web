import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'label', 'caption'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PositionCode = 'GKP' | 'DEF' | 'MID' | 'FWD' | 'UNK';

export function normalizePosition(position?: string | null): PositionCode {
  const normalized = position?.trim().toUpperCase();

  switch (normalized) {
    case 'GKP':
    case 'GOALKEEPER':
      return 'GKP';
    case 'DEF':
    case 'DEFENDER':
      return 'DEF';
    case 'MID':
    case 'MIDFIELDER':
      return 'MID';
    case 'FWD':
    case 'FORWARD':
      return 'FWD';
    default:
      return 'UNK';
  }
}

export function formatCompactNumber(number: number): string {
  const formatter = Intl.NumberFormat('en', { notation: 'compact' });
  return formatter.format(number);
}

export function formatInteger(number: number): string {
  return new Intl.NumberFormat('en-US').format(number);
}

const CHIP_LABELS: Record<string, string> = {
  bboost: 'Bench Boost',
  bb: 'Bench Boost',
  benchboost: 'Bench Boost',
  bench_boost: 'Bench Boost',
  '3xc': 'Triple Captain',
  tc: 'Triple Captain',
  triplecaptain: 'Triple Captain',
  triple_captain: 'Triple Captain',
  wildcard: 'Wildcard',
  wc: 'Wildcard',
  freehit: 'Free Hit',
  fh: 'Free Hit',
  free_hit: 'Free Hit',
};

/** Normalize API enums (BENCH_BOOST) and short codes (bboost) for display. */
export function formatChipName(chipName?: string | null): string {
  if (!chipName) {
    return 'Unknown';
  }

  const raw = chipName.trim().toLowerCase()
  const compact = raw.replace(/[\s-]+/g, '_')
  const nosep = raw.replace(/[\s_-]+/g, '')
  return (
    CHIP_LABELS[raw] ??
    CHIP_LABELS[compact] ??
    CHIP_LABELS[nosep] ??
    chipName
  )
}
